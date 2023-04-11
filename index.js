const puppeteer = require('puppeteer');
const { parseISO, compareAsc, isBefore, format } = require('date-fns')
require('dotenv').config();

const { delay, sendText, logStep } = require('./utils');
const { siteInfo, loginCred, IS_PROD, NEXT_SCHEDULE_POLL, MAX_NUMBER_OF_POLL, NOTIFY_ON_DATE_BEFORE } = require('./config');

let isLoggedIn = false;
let maxTries = MAX_NUMBER_OF_POLL

const login = async (page) => {
  logStep('logging in');
  await page.goto(siteInfo.LOGIN_URL);

  const form = await page.$("form#sign_in_form");

  const email = await form.$('input[name="user[email]"]');
  const password = await form.$('input[name="user[password]"]');
  const privacyTerms = await form.$('input[name="policy_confirmed"]');
  const signInButton = await form.$('input[name="commit"]');


  await email.type(loginCred.EMAIL);
  await password.type(loginCred.PASSWORD,);
  await privacyTerms.click();
  await signInButton.click();
  await page.waitForNavigation();
  await page.waitForSelector('ul.dropdown.menu.align-right.actions a.primary');
  await page.click('ul.dropdown.menu.align-right.actions a.primary');


  await page.click('ul.accordion li.accordion-item:nth-child(4) a.accordion-title', { delay: 2000 });
  await page.click('ul.accordion li.accordion-item:nth-child(4) .accordion-content a');



  return true;
}

const notifyMe = async (earliestDate) => {
  const formattedDate = format(earliestDate, 'dd-MM-yyyy');
  logStep(`sending an email to schedule for ${formattedDate}`);
  await sendText(formattedDate)
}

const checkForSchedules = async (page) => {
  logStep('checking for schedules');
  await page.waitForTimeout(2000)

  let csrfToken = await page.evaluate(() => {
    return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  });
  await page.waitForTimeout(4000)


  // set request headers
  await page.setExtraHTTPHeaders({
    'X-CSRF-Token': csrfToken,
    'X-Requested-With': 'XMLHttpRequest',
  });

  await page.goto(siteInfo.APPOINTMENTS_JSON_URL);

  const originalPageContent = await page.content();

  const bodyText = await page.evaluate(() => {
    return document.querySelector('body').innerText
  });

  try {
    const parsedBody = JSON.parse(bodyText);

    if (!Array.isArray(parsedBody)) {
      throw "Failed to parse dates, probably because you are not logged in";
    }

    const dates = parsedBody.map(item => parseISO(item.date));
    const [earliest] = dates.sort(compareAsc)


    return earliest;
  } catch (err) {
    console.log("Unable to parse page JSON content", originalPageContent);
    console.error(err)
    // define the isLoggedIn variable here if it's not defined elsewhere
    let isLoggedIn = false;
  }
}



const process = async (browser) => {
  logStep(`starting process with ${maxTries} tries left`);

  if (maxTries-- <= 0) {
    console.log('Reached Max tries')
    return
  }

  const page = await browser.newPage();

  if (!isLoggedIn) {
    isLoggedIn = await login(page);
  }

  const earliestDate = await checkForSchedules(page);
  if (earliestDate && isBefore(earliestDate, parseISO(NOTIFY_ON_DATE_BEFORE))) {
    await notifyMe(earliestDate);
  }

  // await delay(NEXT_SCHEDULE_POLL)

  // await process(browser)
}


(async () => {
  const browser = await puppeteer.launch({ headless: true });

  try {
    await process(browser);
  } catch (err) {
    console.error(err);
  }
  await browser.close();

})();