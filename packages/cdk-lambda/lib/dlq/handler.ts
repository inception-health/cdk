import {
  LambdaClient,
  InvokeCommandInput,
  InvokeCommand,
} from "@aws-sdk/client-lambda";
import {
  SQSClient,
  ReceiveMessageCommandInput,
  ReceiveMessageCommand,
  DeleteMessageCommandInput,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

const sqs = new SQSClient();
const lambda = new LambdaClient();

export const handler = async () => {
  // Create an SQS client
  const DLQ_URL = process.env.DLQ_URL;
  const LAMBDA_DESTINATION_ARN = process.env.LAMBDA_DESTINATION_ARN;

  if (!DLQ_URL) throw new Error("Missing DLQ_URL environment variable");
  if (!LAMBDA_DESTINATION_ARN)
    throw new Error("Missing LAMBDA_DESTINATION_ARN environment variable");

  try {
    // Receive messages from the DLQ queue
    const receiveParams: ReceiveMessageCommandInput = {
      QueueUrl: DLQ_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 10, // in seconds
    };
    const response = await sqs.send(new ReceiveMessageCommand(receiveParams), {
      requestTimeout: 30000, // in milliseconds, 30 seconds
    });

    // Check if there are any messages in the DLQ
    if (response.Messages && response.Messages.length > 0) {
      // Process each message
      for (const message of response.Messages) {
        if (!message.Body) continue;

        // Extract the message body
        const body = JSON.parse(message.Body);

        // Push the message to another Lambda function
        const lambdaParams: InvokeCommandInput = {
          FunctionName: LAMBDA_DESTINATION_ARN,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify(body),
        };
        await lambda.send(new InvokeCommand(lambdaParams));

        // Delete the message from the DLQ
        const deleteParams: DeleteMessageCommandInput = {
          QueueUrl: DLQ_URL,
          ReceiptHandle: message.ReceiptHandle,
        };
        // TODO: This should be replaced with a batch delete
        await sqs.send(new DeleteMessageCommand(deleteParams));
      }
    }
  } catch (error) {
    // Log the error
  }
};
