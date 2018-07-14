const AWS = require("aws-sdk");
const logger = require("./logger")(__filename);
const config = require("./config");

class Aws {
  constructor() {
    /**
     * The simple cache for { queueName: queueUrl }.
     * It can help in the only case of launching this project as offline.
     * @type { { [queueName: string]: string } }
     */
    this._queueUrls = {};
  }

  get s3() {
    if (this._s3 === undefined) {
      this._s3 = new AWS.S3(config.get("s3"));
    }
    return this._s3;
  }
  get sqs() {
    if (this._sqs === undefined) {
      this._sqs = new AWS.SQS(config.get("sqs"));
    }
    return this._sqs;
  }
  get dynamodb() {
    if (this._dynamodb === undefined) {
      this._dynamodb = new AWS.DynamoDB.DocumentClient(config.get("dynamodb"));
    }
    return this._dynamodb;
  }
  get dynamodbAdmin() {
    if (this._dynamodbAdmin === undefined) {
      this._dynamodbAdmin = new AWS.DynamoDB(config.get("dynamodb"));
    }
    return this._dynamodbAdmin;
  }

  /**
   * @param {string} queueName
   * @returns {Promise<string>} A promise of queueUrl
   */
  async getQueueUrl(queueName) {
    if (this._queueUrls[queueName] !== undefined) {
      return this._queueUrls[queueName];
    }
    const urlResult = await this.sqs
      .getQueueUrl({
        QueueName: queueName
      })
      .promise();
    logger.stupid(`urlResult`, urlResult);
    return (this._queueUrls[queueName] = urlResult.QueueUrl);
  }

  /**
   * @param {string} queueName
   * @param {*} data
   */
  async enqueue(queueName, data) {
    logger.debug(`Send message[${data.key}] to queue.`);
    logger.stupid(`data`, data);
    const queueUrl = await this.getQueueUrl(queueName);
    const sendResult = await this.sqs
      .sendMessage({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(data),
        DelaySeconds: 0
      })
      .promise();
    logger.stupid(`sendResult`, sendResult);

    const attrResult = await this.sqs
      .getQueueAttributes({
        QueueUrl: queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages"]
      })
      .promise();
    logger.stupid(`attrResult`, attrResult);
    return +attrResult.Attributes["ApproximateNumberOfMessages"];
  }

  /**
   * @template T
   * @param {string} tableName
   * @param { { [keyColumn: string]: string } } key
   * @param {T} defaultValue
   * @returns {Promise<T>} A promise of a retrieved item
   */
  async getDynamoDbItem(tableName, key, defaultValue = {}) {
    logger.debug(`Read an item with key[${key}] from ${tableName}.`);
    const getResult = await this.dynamodb
      .get({
        TableName: tableName,
        Key: key
      })
      .promise();
    logger.stupid(`getResult`, getResult);
    const item =
      getResult !== undefined && getResult.Item !== undefined
        ? getResult.Item
        : defaultValue;
    logger.stupid(`item`, item);
    return item;
  }

  /**
   * @param {string} tableName
   * @param { { [keyColumn: string]: string } } key
   * @param { [ { [column: string]: any } ] } keyValues
   */
  async updateDynamoDbItem(tableName, key, keyValues) {
    logger.debug(`Update an item with key[${key}] to ${tableName}`);
    logger.stupid(`keyValues`, keyValues);
    const expressions = Object.keys(keyValues)
      .map(key => `${key} = :${key}`)
      .join(", ");
    const attributeValues = Object.keys(keyValues)
      .map(key => [`:${key}`, keyValues[key]])
      .reduce((obj, pair) => ({ ...obj, [pair[0]]: pair[1] }), {});
    logger.stupid(`expressions`, expressions);
    logger.stupid(`attributeValues`, attributeValues);
    const updateResult = await this.dynamodb
      .update({
        TableName: tableName,
        Key: key,
        UpdateExpression: `set ${expressions}`,
        ExpressionAttributeValues: attributeValues
      })
      .promise();
    logger.stupid(`updateResult`, updateResult);
    return updateResult;
  }
}

module.exports = new Aws();
