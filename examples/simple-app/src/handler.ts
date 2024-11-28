export const handler = async () => {
  console.log("Hello, world!");
  return {
    statusCode: 200,
    body: JSON.stringify("Hello, world!"),
  };
};
