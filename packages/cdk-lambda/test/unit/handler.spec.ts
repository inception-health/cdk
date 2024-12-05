import path from "path";

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

jest.mock("@aws-sdk/client-sqs");
jest.mock("@aws-sdk/client-lambda");

describe("handler", () => {
  let mockSqsSend: jest.Mock;
  let mockLambdaSend: jest.Mock;
  let oldEnv: any;

  beforeEach(() => {
    oldEnv = process.env;
    mockSqsSend = jest.fn();
    (SQSClient as jest.Mock).mockImplementation(() => ({
      send: mockSqsSend,
    }));

    mockLambdaSend = jest.fn();
    (LambdaClient as jest.Mock).mockImplementation(() => ({
      send: mockLambdaSend,
    }));

    process.env.DLQ_URL = "test-dlq-url";
    process.env.LAMBDA_DESTINATION_ARN = "test-lambda-arn";
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  it("should receive messages from the DLQ and invoke a Lambda function", async () => {
    const mockMessage = {
      Body: JSON.stringify({ test: "message" }),
      ReceiptHandle: "test-receipt-handle",
    };
    mockSqsSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });
    mockLambdaSend.mockResolvedValueOnce({});
    mockSqsSend.mockResolvedValueOnce({});

    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { handler } = require(path.join(__dirname, "../../lib/dlq/handler"));

    await handler();

    expect(mockSqsSend).toHaveBeenCalledWith(
      expect.any(ReceiveMessageCommand),
      { requestTimeout: 30000 },
    );
    expect(mockLambdaSend).toHaveBeenCalledWith(expect.any(InvokeCommand));
    expect(mockSqsSend).toHaveBeenCalledWith(expect.any(DeleteMessageCommand));
  });
});
