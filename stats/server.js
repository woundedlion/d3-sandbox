const https = require('https');
const express = require('express');
const app = express();
const source = 'https://data.ca.gov/api/3/action/datastore_search_sql';
const resource = '42d33765-20fd-44b8-a978-b083b7542225'

app.get('/stats/hospitalization_by_county', (req, res) => {
    const sql =
	  `SELECT todays_date, county,
                  hospitalized_covid_patients,
                  hospitalized_suspected_covid_patients
                  FROM "${resource}"
                  WHERE todays_date IS NOT NULL
                  ORDER BY todays_date`;
    app.query_stats(sql, res);
});

app.query_stats = (sql, res) => {
    https.get(source + '?sql=' + encodeURIComponent(sql), r => {
	r.on('data', chunk => {
	    res.write(chunk);
	});
	r.on('end', () => {
	    res.end();
	});
    }).on('error', e => {
	console.log(e);
    });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

