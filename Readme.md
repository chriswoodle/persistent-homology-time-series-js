# About

This Typescript library provides a 1d persistent homology algorithm usefull for analyzing time series data. Implementation based on: [Persistent homology in TDA](https://geometrica.saclay.inria.fr/team/Fred.Chazal/Barcelona2016/slides/PersistenceForTDA.pdf)

![Sample PH](https://raw.github.com/chriswoodle/persistent-homology-time-series-js/master/example.png)

> Note: calculations are computed using JavaScript primitive numbers, so floating point errors are to be expected.

# Setup

1. Install [NodeJS LTS](https://nodejs.org/en/)
2. Install [Yarn](https://classic.yarnpkg.com/lang/en/)
3. Install dependencies
    ```
    yarn install
    ```
4. Build typescript code
    ```
    yarn build
    ```

## Debugging
Enable debug logs
```
export DEBUG=ph:*
```

# Running example/tests
After following the setup instructions, run teh following commands:

```
yarn test
```
This test runs a small example signal that can be traced by hand.


```
yarn csv-test ./test/owid-covid-data.csv 1
```

This script loads a csv file COVID-19 by country by day. It then computes the persistence of each total-cases data set, and the persistence of the first derivitive of each dataset. It then compares the distance between the persistence of each country and searches for the most similar country (first derivitive with smalles total distance).


The output.json file contais 2 main sections. Each Country is a Key in the map, which contains the preprocessed signal `_processedData`, its derivitive signal `_processedDerivativeData`, the persistence of both signals `_ph` and `_phDerivative`, and a map of the distance between each other country.
The 2nd sction `_comparison` is the most similar country. 


> Sample data taken from: https://github.com/owid/covid-19-data/tree/master/public/data

# Notes
Graphic created in matlab