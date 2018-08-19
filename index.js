#!/usr/bin/env node

const argv = require('yargs').argv
const getProps = require('mongodb-get-props');
const _ = require('lodash');
const S = require('string');
const fs = require('fs');
const muri = require('muri');
const kutu = require('kutu');
const chalk = require('chalk');
const log = console.log;
const ora = require('ora');
const Confirm = require('prompt-confirm');
const prompt = new Confirm('destination is not empty, continue?');

(async () => {

  const textToType = {
    'string': '*String*',
    'int': '*Number*',
    'date': '*Date*',
    'array': '*[]*',
    'objectId': '*ObjectId*',
    'object': '*{}*',
    'bool': '*Boolean'
  }

  const MongoClient = require('mongodb').MongoClient;

  let uri = 'mongodb://localhost:27017';

  if (!argv.uri || typeof argv.uri != "string") {
    log(chalk.red('where is uri?'))
    process.exit()
  }
  
  try {
    muri(argv.uri)

    uri = argv.uri
  } catch (e) {
    uri += '/'+argv.uri
  }

  const mf = argv.folder || 'models'

  try {
    if (fs.existsSync(mf)) {
      await new Promise((resolve, reject) => fs.readdir(mf, async (err, files) => {
        if (err) {
          log(chalk.red(err))
          process.exit()
        } else {
         if (files.length) {
           if (await prompt.run()) {
              resolve()
           } else {
              process.exit()
           }
         }
        }
      })); 
    }
  } catch (e) {
    log(chalk.red(err))
    process.exit()
  }

  const collection = muri(uri).db;

  const client = await MongoClient.connect(uri);

  const db = client.db(collection);

  const collections = await db
    .collections()
    .then(tables =>
      tables
        .filter(({collectionName}) => !collectionName.match(/_keys/))
        .map(table => table.s.name)
    );

  if (!collections.length) {
    log(chalk.yellow('collection not found.'))
    process.exit()
  }

  const spinner = ora(chalk.green('models creating... 👷')).start();
  
  const models = [];

  for (let name of collections) {
    let fields = (await getProps(db, name));
    
    fields = _.mapValues(fields, (value, key) => {
      return textToType[value]
    })
  
    name = S(name).capitalize().s

    models.push({
    name: `${name}.js`,
    content: `
const mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId

const ${name} = new Schema(${JSON.stringify(fields, 0, 4).replace(/"\*(.*?)\*"/g, "$1")});

module.exports = mongoose.model('${name}', ${name});
    `.trim()
    })
  }

  await kutu(mf, models)
  
  spinner.stop()

  log(chalk.cyan(`
${models.length} models created!\n
${models.map(({name}, index) => `  ${index+1} - ${name}`).join('\n')}
  `.trim()));

  process.exit();

})();
