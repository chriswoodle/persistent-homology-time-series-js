const filePath = process.argv[2];
if (!filePath) throw new Error('Please enter path to .csv file!');

let resolution: number;
try {
    resolution = parseFloat(process.argv[3]);
    if (!resolution) throw new Error();
    console.log(`Using resolution: ${resolution}`);
} catch (error) {

} finally {
    resolution = 1;
    console.log(`Using default resolution: ${resolution}`);
}


import { PersistentHomology, euclideanCompare } from '../';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import * as path from 'path';

const countries: any = {};
const preparedData: any = {};
const preparedDerivativeData: any = {};
const outputData: any = {};

fs.createReadStream(path.resolve(filePath))
    .pipe(csv())
    .on('data', (row) => {
        countries[row.location] = countries[row.location] || [];
        countries[row.location].push(row)
    })
    .on('end', () => {
        console.log('CSV file successfully processed');
        processData();
    });

function processData() {
    console.log(`Number of countries: ${Object.keys(countries).length}`);
    const hrstart = process.hrtime();

    Object.entries<any>(countries).forEach(entry => {
        const country = entry[0];
        const countryData = entry[1];
        // Get last 

        let processedData = countryData.map((day: any) => (parseInt(day.total_cases)))
        const scalar = Math.max.apply(Math, processedData);
        processedData = processedData.map((value: number) => (value / scalar) * 100);
        if (processedData.every((item: any) => item === processedData[0])) {
            console.warn(`Country ${country} data is all the same, skipping`);
            return;
        }
        if (processedData.every((item: any) => item === 0)) {
            console.warn(`Country ${country} data is empty, skipping`);
            return;
        }
        preparedData[country] = processedData;
        preparedDerivativeData[country] = [];
        for (let i = 1; i < processedData.length; i++) {
            preparedDerivativeData[country].push(processedData[i] - processedData[i - 1]);
        }
    });

    // Compute all ph
    for (let i = 0; i < Object.keys(preparedData).length; i++) {
        const sourceCountry = Object.keys(preparedData)[i];
        let phSource = new PersistentHomology(preparedData[sourceCountry], resolution);
        phSource.execute();
        let phSourceDerivative = new PersistentHomology(preparedDerivativeData[sourceCountry], resolution);
        phSourceDerivative.execute();

        outputData[sourceCountry] = {
            _processedData: preparedData[sourceCountry],
            _processedDerivativeData: preparedDerivativeData[sourceCountry],
            _ph: phSource.persistence,
            _phDerivative: phSourceDerivative.persistence
        };
    }

    // Compare all ph O(n^2)
    for (let i = 0; i < Object.keys(preparedData).length; i++) {
        const sourceCountry = Object.keys(preparedData)[i];
        console.log(`Starting compare of ${sourceCountry}`);
        try {
            for (let j = i + 1; j < Object.keys(preparedData).length; j++) {
                const targetCountry = Object.keys(preparedData)[j];
                try {
                    outputData[sourceCountry][targetCountry] = outputData[sourceCountry][targetCountry] || {}
                    outputData[sourceCountry][targetCountry].signalPh = euclideanCompare(outputData[sourceCountry]._ph, outputData[targetCountry]._ph);
                    outputData[sourceCountry][targetCountry].derivativePh = euclideanCompare(outputData[sourceCountry]._phDerivative, outputData[targetCountry]._phDerivative);
                } catch (error) {
                    console.log(`Failed to compare ${sourceCountry}, ${targetCountry}`);
                    console.log(error);
                    console.log(preparedData[sourceCountry]);
                    console.log(preparedData[targetCountry]);
                    process.exit(1);
                }
            }
        } catch (error) {
            console.log(`Failed to compute ${sourceCountry}`);
            console.log(error);
            console.log(preparedData[sourceCountry]);
            process.exit(1);
        }
    }

    // Search for closest matches
    for (let i = 0; i < Object.keys(preparedData).length; i++) {
        const sourceCountry = Object.keys(preparedData)[i];
        let smallest = Infinity;
        let mostSimilarCountry = null;
        for (let j = 0; j < Object.keys(preparedData).length; j++) {
            const targetCountry = Object.keys(preparedData)[j];
            if (targetCountry === sourceCountry) continue;
            const distance = outputData[sourceCountry][targetCountry]?.derivativePh.totalDistance || outputData[targetCountry][sourceCountry]?.derivativePh.totalDistance;
            if (distance !== undefined && distance < smallest) {
                smallest = distance;
                mostSimilarCountry = targetCountry;
            }
        }
        outputData._comparison = outputData._comparison || {};
        outputData._comparison[sourceCountry] = mostSimilarCountry;
    }

    const hrend = process.hrtime(hrstart);
    console.info('Execution time: %ds %dms', hrend[0], hrend[1] / 1000000)
    fs.writeFileSync('output.json', JSON.stringify(outputData, null, "\t"));
}