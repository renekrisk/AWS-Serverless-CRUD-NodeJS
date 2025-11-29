'use strict';

const DynamoDB = require('aws-sdk/clients/dynamodb');

const documentClient = new DynamoDB.DocumentClient({
  region: 'us-east-1',
  maxRetries: 3,
  httpOptions: { timeout: 5000 },
});

const NOTES_TABLE_NAME = process.env.NOTES_TABLE_NAME;

// Helper response
const send = (statusCode, message) => ({
  statusCode,
  body: JSON.stringify(message),
});

// Unified handler wrapper
const handle = async (cb, fn) => {
  try {
    const result = await fn();
    cb(null, send(200, result));
  } catch (err) {
    cb(null, send(500, err.message || 'Internal Server Error'));
  }
};

// CREATE NOTE
module.exports.createNote = (event, context, cb) => {
  handle(cb, async () => {
    const data = JSON.parse(event.body || '{}');

    const item = {
      notesId: data.id,
      timestamp: Date.now(),
      title: data.title,
      body: data.body,
    };

    await documentClient
      .put({
        TableName: NOTES_TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(notesId)',
      })
      .promise();

    return item;
  });
};

// UPDATE NOTE
module.exports.updateNote = (event, context, cb) => {
  handle(cb, async () => {
    const id = event.pathParameters.id;
    const data = JSON.parse(event.body || '{}');

    await documentClient
      .update({
        TableName: NOTES_TABLE_NAME,
        Key: { notesId: id },
        UpdateExpression: 'SET #t = :title, #b = :body',
        ExpressionAttributeNames: {
          '#t': 'title',
          '#b': 'body',
        },
        ExpressionAttributeValues: {
          ':title': data.title,
          ':body': data.body,
        },
        ConditionExpression: 'attribute_exists(notesId)',
      })
      .promise();

    return { id, ...data };
  });
};

// DELETE NOTE
module.exports.deleteNote = (event, context, cb) => {
  handle(cb, async () => {
    const id = event.pathParameters.id;

    await documentClient
      .delete({
        TableName: NOTES_TABLE_NAME,
        Key: { notesId: id },
        ConditionExpression: 'attribute_exists(notesId)',
      })
      .promise();

    return 'Note deleted';
  });
};

// GET ALL NOTES
module.exports.getAllNotes = (event, context, cb) => {
  handle(cb, async () => {
    const data = await documentClient
      .scan({ TableName: NOTES_TABLE_NAME })
      .promise();

    return data.Items || [];
  });
};
