const config = {
  s3: {
    version: "2006-03-01",
    region: "ap-northeast-2"
  },
  sqs: {
    version: "2012-11-05",
    region: "ap-northeast-2"
  },
  dynamodb: {
    version: "2012-11-05",
    region: "ap-northeast-2"
  }
};

/**
 * @param { "s3" | "sqs" | "dynamodb" } service
 * @returns { { version: string, region: string, ... } }
 */
function get(service) {
  return config[service];
}

module.exports = {
  get: get
};
