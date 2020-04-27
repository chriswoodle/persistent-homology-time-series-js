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

```
yarn csv-test ./test/owid-covid-data.csv 1
```

> Sample data taken from: https://github.com/owid/covid-19-data/tree/master/public/data

# Notes
Graphic created in matlab