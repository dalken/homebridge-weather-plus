/*jshint esversion: 6,node: true,-W041: false */
"use strict";

const request = require('request'),
    converter = require('../util/converter'),
    moment = require('moment-timezone'),
    geoTz = require('geo-tz'),
    xml2js = require('xml2js');


class WeewxRssAPI {
    constructor(location, l, d) {
        this.attribution = 'Powered by weewx';
        this.reportCharacteristics = [
            'ObservationTime',
            'Temperature',
            'DewPoint',
            'Humidity',
            'AirPressure',
            'Rain1h',
            'RainDay',
            'WindSpeed',
            'WindDirection',
            'WindSpeedMax'
        ];
        this.forecastCharacteristics = [];
        this.forecastDays = 0;

        this.location = location;
        this.log = l;
        this.debug = d;
    }

    update(callback) {
        this.debug("Updating weather with weewx");

        const queryUri = this.location;
        request(encodeURI(queryUri), function (err, response, body) {
            if (!err) {
                // Current weather report
                const parser = new xml2js.Parser();
                parser.parseString(body, function(error, result) {
                    if(error === null) {
                        this.parseReport(result, callback);
                    }
                    else {
                        this.log(error);
                    }
                }.bind(this));
                const xmlObj = null;
            } else {
                this.log.error("Error retrieving weather report");
                this.log.error("Error Message: " + err);
                callback(err);
            }
        }.bind(this));
    }

    parseReport(xmlObj, callback) {
        let report = {};
        const channel = xmlObj.rss.channel[0];
        const conditionsElement = channel.item[0];
        const conditions = this.parseItem(conditionsElement['content:encoded'][0]);
        const dailyElement = channel.item[1];
        const daily = this.parseItem(dailyElement['content:encoded'][0]);
        const timezone = geoTz(parseFloat(conditionsElement["geo:lat"][0]), parseFloat(conditionsElement["geo:long"][0]));
        this.debug("Using Timezone: " + timezone);

        report.ObservationTime = moment(conditions.Time, "DD.MM.YYYY HH:mm:ss").tz(timezone).format('HH:mm:ss');
        report.Temperature = parseFloat(conditions.OutsideTemperature);
        report.DewPoint = parseFloat(conditions.Dewpoint);
        report.Humidity = parseFloat(conditions.Humidity);
        report.AirPressure = Math.round(parseFloat(conditions.Barometer));
        report.Rain1h =parseFloat(conditions.RainRate) * 10.0;
        report.RainDay = parseFloat(daily.Raintoday) * 10.0;
        report.WindSpeedMax = parseFloat(daily.MaxWind) / 3.6;
        const wind = conditions.Wind.split(' kph from ');
        report.WindSpeed = parseFloat(wind[0]) / 3.6;
        report.WindDirection = converter.getWindDirection(parseInt(wind[1]));

        const weather = {};
        weather.report = report;
        weather.forecasts = [];
        callback(null, weather);
    }

    parseItem(item) {
        let result = {};
        item.split(/[\r\n]+/).forEach(function (line) {
            let [name, ...value] = line.split(':');
            if (!value.length) {
                return;
            }
            name = name.trim().replace(/ /g,'');
            value = value.join(':').trim().split(/[&<]+/)[0].replace(/,/g,'.');
            result[name] = value
        });
        return result
    }
}

module.exports = {
    WeewxRssAPI: WeewxRssAPI
};