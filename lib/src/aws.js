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
   * @param {string} queueName
   * @param {number} fetchSize
   * @param {number} waitSeconds
   * @param {number} visibilityTimeout
   */
  async dequeue(
    queueName,
    fetchSize = 1,
    waitSeconds = 1,
    visibilityTimeout = 15
  ) {
    logger.debug(`Receive message from queue[${queueName}].`);
    const queueUrl = await this.getQueueUrl(queueName);
    const receiveResult = await this.sqs
      .receiveMessage({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: fetchSize,
        WaitTimeSeconds: waitSeconds,
        VisibilityTimeout: visibilityTimeout
      })
      .promise();
    logger.stupid(`receiveResult`, receiveResult);
    if (
      receiveResult.Messages === undefined ||
      receiveResult.Messages.length === 0
    ) {
      return [];
    }
    const data = [];
    for (const each of receiveResult.Messages) {
      data.push({
        handle: each.ReceiptHandle,
        body: JSON.parse(each.Body)
      });
    }
    logger.debug(`Receive a job[${JSON.stringify(data)}] from queue`);
    return data;
  }

  /**
   * @param {string} queueName
   * @param {string} handle
   * @param {number} seconds
   */
  async retain(queueName, handle, seconds) {
    logger.debug(`Change visibilityTimeout of ${handle} to ${seconds}secs.`);
    const queueUrl = await this.getQueueUrl(queueName);
    const changeResult = await this.sqs
      .changeMessageVisibility({
        QueueUrl: queueUrl,
        ReceiptHandle: handle,
        VisibilityTimeout: seconds.toString()
      })
      .promise();
    logger.stupid(`changeResult`, changeResult);
    return handle;
  }

  /**
   * @param {string} queueName
   * @param {string} handle
   */
  async complete(queueName, handle) {
    logger.debug(`Complete a message with handle[${handle}]`);
    const queueUrl = await this.getQueueUrl(queueName);
    const deleteResult = await this.sqs
      .deleteMessage({
        QueueUrl: queueUrl,
        ReceiptHandle: handle
      })
      .promise();
    logger.stupid(`deleteResult`, deleteResult);
    return handle;
  }
  /**
   * @template T
   * @param {string} tableName
   * @param { { [keyColumn: string]: string } } key
   * @param {T} defaultValue
   * @returns {Promise<T>} A promise of a retrieved item
   */
  async getDynamoDbItem(tableName, key, defaultValue = {}) {
    logger.debug(
      `Read an item with key[${JSON.stringify(key)}] from ${tableName}.`
    );
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
    logger.debug(
      `Update an item with key[${JSON.stringify(key)}] to ${tableName}`
    );
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
