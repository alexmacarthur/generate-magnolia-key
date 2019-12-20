#!/usr/bin/env node

const puppeteer = require("puppeteer");
const chalk = require("chalk");

const CREDS = {
  username: "superuser",
  password: "superuser"
};

/**
 * Given a page, log in using username & password.
 *
 * @param {object}
 * @return {Promise}
 */
const authenticate = async page => {
  await page.focus("#login-username");
  await page.keyboard.type(CREDS.username);
  await page.focus("#login-password");
  await page.keyboard.type(CREDS.password);
  await page.click("#login-button");
  await page.waitForNavigation();
  return;
};

/**
 * Wait for a response from a certain endpoint, a certain number of times.
 *
 * @param {object}
 * @return {Promise}
 */
const waitForSuccessfulResponse = async ({
  page,
  endOfUrl = "UIDL/?v-uiId=0",
  numberOfTimes = 1,
  timeout = 0
} = {}) => {
  for (let i = 0; i < new Array(numberOfTimes).length; i++) {
    await page.waitForResponse(
      response => {
        return response.url().endsWith(endOfUrl) && response.status() === 200;
      },
      {
        timeout
      }
    );
  }

  return;
};

/**
 * Click an element and wait for a response. If expected response doesn't happen, do it again until it does.
 *
 * @param {object}
 * @return {Promise}
 */
const clickUntilResponse = async ({
  page,
  selector,
  clickCount = 1,
  numberOfTimesToWaitForResponse = 1
} = {}) => {
  await page.waitForSelector(selector, { visible: true });

  let node = await page.$(selector);

  await node
    .click({
      clickCount
    })
    .catch(e => {});

  try {
    return await waitForSuccessfulResponse({
      page,
      timeout: 3000, // totes arbitrary
      numberOfTimes: numberOfTimesToWaitForResponse
    });
  } catch (e) {
    return await clickUntilResponse({
      page,
      selector,
      clickCount,
      numberOfTimesToWaitForResponse
    });
  }
};

/**
 * Return a new key after generating one in the Magnolia admin.
 *
 * @param {object}
 * @return {Promise}
 */
const getFreshKey = async page => {
  await page.goto("http://localhost:8080", { waitUntil: "networkidle0" });
  await authenticate(page);
  await page.goto(
    "http://localhost:8080/.magnolia/admincentral#app:publishing:;",
    { waitUntil: "domcontentloaded" }
  );

  await clickUntilResponse({
    page,
    selector: "button.v-nativebutton-btn-dialog"
  });

  return await page.evaluate(() => {
    return document.querySelector("textarea.v-readonly").value;
  });
};

/**
 * Update the public instance with a given key.
 *
 * @param {object} page
 * @param {string} key
 */
const updatePublicInstance = async (page, key) => {
  await page.goto("http://localhost:8888", { waitUntil: "networkidle0" });
  await authenticate(page);
  await page.goto(
    "http://localhost:8888/.magnolia/admincentral#app:configuration:browser;/server/activation@publicKey:treeview:",
    { waitUntil: "networkidle0" }
  );

  await clickUntilResponse({
    page,
    selector:
      "tr.v-selected .v-table-cell-content:nth-child(2) .v-table-cell-wrapper",
    clickCount: 2,
    numberOfTimesToWaitForResponse: 2
  });

  await page.keyboard.press("Backspace");
  await page.keyboard.type(key);
  await page.keyboard.press("Enter");

  return await waitForSuccessfulResponse({ page, numberOfTimes: 2 });
};

(async () => {
  console.log(
    chalk.green("Updating Magnolia key! This may take a few seconds.")
  );

  const browserForAuthorInstance = await puppeteer.launch({
    args: ["--incognito"]
  });
  const browserForPublicInstance = await puppeteer.launch({
    args: ["--incognito"]
  });

  const pageForAuthorInstance = await browserForAuthorInstance.newPage();
  const pageForPublicInstance = await browserForPublicInstance.newPage();

  console.log(chalk.yellow("Generating new key in author instance..."));
  const newKey = await getFreshKey(pageForAuthorInstance);

  console.log(chalk.yellow("Setting new key in public instance..."));
  await updatePublicInstance(pageForPublicInstance, newKey);

  await browserForAuthorInstance.close();
  await browserForPublicInstance.close();

  console.log(
    chalk.green("Key has been updated! In case want it, here it is:\n")
  );
  console.log(chalk.yellow(newKey));
  process.exit();
})();
