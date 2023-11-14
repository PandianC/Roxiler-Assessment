const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const fetch = require("node-fetch");

const databasePath = path.join(__dirname, "product_table.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const getMonth = (num) => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[num - 1];
};

app.post("/post", async (request, response) => {
  const url = "https://s3.amazonaws.com/roxiler.com/product_transaction.json";
  const response = await fetch(url);

  if (response.ok) {
    const data = await response.json();
    let fetchedData = data;
    const placeholder = fetchedData.map((each) =>
      db.run(`
    INSERT INTO product_details(id, title, PRICE, description,category,image,sold, dateOfSale)
    VALUES (${each.id},"${each.title}", ${each.price}, "${
        each.description
      }", "${each.category}", "${each.image}", ${each.sold}, "${getMonth(
        each.dateOfSale.split("-")[1]
      )}");`)
    );
  }
  response.send("Inserted Successfully");
});

/* Pagination and limit offset API*/

app.get("/", async (request, response) => {
  const getQuery = `SELECT * FROM product_details`;

  const res = await db.all(getQuery);
  response.send(res);
});

app.get("/transactions/", async (request, response) => {
  const { search = "", limit = 10, page = 1 } = request.query;
  const getBySearchQuery = `
    SELECT (PRICE * (sold)) as trans FROM product_details 
    WHERE title LIKE '%${search}%' 
    OR description LIKE "%${search}%"
    OR PRICE LIKE "%${search}%"
    ORDER BY trans desc
    LIMIT ${limit} OFFSET ${page - 1 * 10};`;

  const result = await db.all(getBySearchQuery);
  response.send(result);
});

/* Statistics API */

app.get("/statistics/", async (request, response) => {
  const { month = "March" } = request.query;

  const getTotalQuery = `
    SELECT sum(price * sold) as totalSale from product_details 
    WHERE dateOfSale LIKE "%${month}%"
    `;
  const getNumOfSale = `
    SELECT sum(sold) as soldItems from product_details 
    WHERE sold > 0 
    AND dateOfSale LIKE "%${month}%"`;

  const getNotSale = `
    SELECT count(sold) as unsold from product_details 
    WHERE sold = 0 
    AND dateOfSale LIKE "%${month}%"`;

  const totalSale = await db.all(getTotalQuery);

  const numOfSale = await db.all(getNumOfSale);
  const numOfNotSale = await db.all(getNotSale);
  const result = [];
  result.push(...totalSale, ...numOfSale, ...numOfNotSale);

  response.send(result);
});

/* Bar chart API */

app.get("/barchart/", async (request, response) => {
  const { month = "June" } = request.query;
  const getRange0 = `
    SELECT count(*) as "0-100" from product_details where PRICE < 101 AND dateOfSale = "${month}"`;

  const getRange1 = `
    SELECT count(*) as "100-200" from product_details where (PRICE > 100 AND PRICE < 201) AND dateOfSale = "${month}"`;
  const getRange2 = `
    SELECT count(*) as "200-300" from product_details where (PRICE > 200 AND PRICE < 301) AND dateOfSale = "${month}"`;
  const getRange3 = `
    SELECT count(*) as "300-400" from product_details where (PRICE > 300 AND PRICE < 401) AND dateOfSale = "${month}"`;
  const getRange4 = `
    SELECT count(*) as "400-500" from product_details where (PRICE > 400 AND PRICE < 501) AND dateOfSale = "${month}"`;
  const getRange5 = `
    SELECT count(*) as "500-600" from product_details where (PRICE > 500 AND PRICE < 601) AND dateOfSale = "${month}"`;
  const getRange6 = `
    SELECT count(*) as "600-700" from product_details where (PRICE > 600 AND PRICE < 701) AND dateOfSale = "${month}"`;
  const getRange7 = `
    SELECT count(*) as "700-800" from product_details where (PRICE > 700 AND PRICE < 801) AND dateOfSale = "${month}"`;
  const getRange8 = `
    SELECT count(*) as "800-900" from product_details where (PRICE > 800 AND PRICE < 901) AND dateOfSale = "${month}"`;
  const getRange9 = `
    SELECT count(*) as "900-above" from product_details where PRICE > 900 AND dateOfSale = "${month}"`;

  const res1 = await db.all(getRange0);
  const res2 = await db.all(getRange1);
  const res3 = await db.all(getRange2);
  const res4 = await db.all(getRange3);
  const res5 = await db.all(getRange4);
  const res6 = await db.all(getRange5);
  const res7 = await db.all(getRange6);
  const res8 = await db.all(getRange7);
  const res9 = await db.all(getRange8);
  const res0 = await db.all(getRange9);

  const result = [
    ...res1,
    ...res2,
    ...res3,
    ...res4,
    ...res5,
    ...res6,
    ...res7,
    ...res8,
    ...res9,
    ...res0,
  ];
  response.send(result);
});

/* Pie chart API */

app.get("/pieChart/", async (request, response) => {
  const { month = "June" } = request.query;
  const categoryQuery = `
    SELECT count(category) as value from product_details group by category`;

  const categoryItem = `
    SELECT distinct(category) from product_details `;

  const categories = await db.all(categoryQuery);
  const categoryItems = await db.all(categoryItem);
  const keyValue = [];

  for (let i = 0; i < 4; i++) {
    keyValue.push(`${categoryItems[i].category}: ${categories[i].value}`);
  }
  response.send(keyValue);
});

/*Combination of the APIs */

app.get("/combined/", async (request, response) => {
  const urls = [
    "http://localhost:3000/statistics/",
    "http://localhost:3000/barchart/",
    "http://localhost:3000/pieChart/",
  ];
  let res = [];
  for (let url of urls) {
    const result = await fetch(url);
    const data = await result.json();
    await res.push(...data);
  }
  response.send(res);
});

module.exports = app;
