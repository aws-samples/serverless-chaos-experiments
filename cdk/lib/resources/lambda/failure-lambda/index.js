// require the failure-lambda wrapper to support Chaos Engineering
const failureLambda = require('failure-lambda');

exports.handler = failureLambda(async (event, context) => {
    console.log("EVENT: \n" + JSON.stringify(event, null, 2));

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Hello world" }),
    };
});