
const config = require('./config');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require('twilio')(accountSid, authToken);

const debug = async (page, logName, saveScreenShot) => {
  if (saveScreenShot) {
    await page.screenshot({ path: `${logName}.png` });
  }

  await page.evaluate(() => {
    debugger;
  });
};

const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));

const sendText = async (data) => {

  await client.messages
    .create({
      body: `We found an earlier date :${data}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.YOUR_PHONE_NUMBER
    })
    .then(message => console.log(message.sid));
}

const logStep = (stepTitle) => {
  console.log("=====>>> Step:", stepTitle);
}

module.exports = {
  debug,
  delay,
  sendText,
  logStep
}