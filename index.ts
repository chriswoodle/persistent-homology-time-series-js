class SimplicialComplex {
    private points: number[] = [];
    private thresholdAtDeath?: number;
    constructor(private thresholdAtBirth: number, indexes: number[]) {
        console.log('New complex')
        indexes.forEach(index => {
            this.points.push(index);
        });
    }

    public get isDead() {
        return !!this.thresholdAtDeath;
    }

    public size() {
        return this.points.length;
    }

    public check(index: number) {
        return this.points.includes(index);
    }
    public addPoint(point: number) {
        this.points.push(point);
    }
    public addPoints(points: number[]) {
        points.forEach(point => {
            this.points.push(point);
        });
    }

    public merge(threshold: number, other: SimplicialComplex) {
        other.points.forEach(p => this.points.push(p));
        other.dispose(threshold);
    }

    public dispose(threshold: number) {
        this.thresholdAtDeath = threshold;
    }

    public get persistence() {
        if (!this.thresholdAtDeath)
            throw new Error('Complex has not died yet!');
        return [this.thresholdAtBirth, this.thresholdAtDeath];
    }
}

interface HistoryAction {
    type: 'Birth' | 'Death';
    threshold: number;
}

interface ArrayItem {
    index: number;
    value: number;
}

const DEFAULT_RESOLUTON = 0.01;

class PersistentHomology {
    private min: number;
    private max: number;
    private ordered: number[];
    private complexes: SimplicialComplex[] = [];
    private history: HistoryAction[] = [];
    constructor(
        private signal: number[],
        private resolution: number = DEFAULT_RESOLUTON
    ) {
        this.ordered = [...signal]; // copy array by value
        this.ordered.sort((a, b) => a - b);
        this.min = this.ordered[0];
        this.max = this.ordered[this.ordered.length - 1];
    }

    private getComplexContainingPoint(p: number) {
        const complex = this.complexes
            .filter(complex => !complex.isDead)
            .find(complex => {
                return complex.check(p);
            });
        if (!complex)
            throw new Error('Could not find complex!');
        return complex;
    }

    private mergeComplexes(threshold: number, a: SimplicialComplex, b: SimplicialComplex) {
        // Older complex has more points
        if (a.size() >= b.size()) {
            // Merge "b" into "a"
            a.merge(threshold, b);
        } else {
            // Merge "a" into "b"
            b.merge(threshold, a);
        }
    }

    public execute() {
        // Start timer:
        const hrstart = process.hrtime()
        // Loop increasing threshold 
        // Start from lowest value point, end when past highest value point
        let threshold: number;
        for (threshold = this.min; threshold < this.max + this.resolution; threshold += this.resolution) {
            const ranges: ArrayItem[][] = this.signal
                .map((value, index) => {
                    // Convert array to array of objects
                    return { value, index } as ArrayItem;
                })
                .filter((element) => {
                    // Filter out all values not in the currentm threshold slice
                    return element.value <= threshold && element.value > threshold - this.resolution
                })
                .reduce((accumulator, value) => {
                    // Group sequential ranges
                    // Based on https://stackoverflow.com/a/47906920
                    const group = accumulator[accumulator.length - 1];

                    if (!group) {
                        accumulator.unshift([] as ArrayItem[]);
                    }
                    else {
                        const lastItemInFirstGroup = group[group.length - 1];
                        if (lastItemInFirstGroup && lastItemInFirstGroup.index !== value.index - 1) {
                            // If next item is not 
                            accumulator.push([] as ArrayItem[]);
                        }
                    }

                    accumulator[accumulator.length - 1].push(value);

                    return accumulator;
                }, [] as ArrayItem[][]);

            if (ranges.length > 0) {
                console.log('---------------------------------------------------');
                console.log('ranges', ranges);
                console.log('threshold', threshold);
                console.log('complexes', this.complexes);

                ranges.forEach((range) => {
                    console.log('range', range);
                    const leftIndex = range[0].index - 1;
                    const rightIndex = range[range.length - 1].index + 1;
                    const left = this.signal[leftIndex];
                    const right = this.signal[rightIndex];
                    const value = range[0].value; // Select first value of range, other values do not matter
                    const indexes = range.map(element => element.index);
                    if (left === undefined) {
                        // Beginning of signal
                        if (right >= value) {
                            const complex = new SimplicialComplex(threshold, indexes);
                            this.complexes.push(complex);
                            this.history.push({ type: 'Birth', threshold });
                            return;
                        } else {
                            const complex = this.getComplexContainingPoint(rightIndex);
                            complex.addPoints(indexes);
                            return;
                        }
                    }
                    if (right === undefined) {
                        // End of signal
                        if (left > value) {
                            const complex = new SimplicialComplex(threshold, indexes);
                            this.complexes.push(complex);
                            this.history.push({ type: 'Birth', threshold });
                            return;
                        } else {
                            const complex = this.getComplexContainingPoint(leftIndex);
                            complex.addPoints(indexes);
                            return;
                        }
                    }

                    if (left <= value && right <= value) {
                        // Local Maximum
                        const leftComplex = this.getComplexContainingPoint(leftIndex);
                        const rightComplex = this.getComplexContainingPoint(rightIndex);
                        // Add current points to left complex
                        leftComplex.addPoints(indexes);
                        // Merge older complex into newer complex
                        this.mergeComplexes(threshold, leftComplex, rightComplex);
                        this.history.push({ type: 'Death', threshold });
                        return;
                    }

                    if (left > value && right > value) {
                        // Local Minimum
                        const complex = new SimplicialComplex(threshold, indexes);
                        this.complexes.push(complex);
                        this.history.push({ type: 'Birth', threshold });
                        return;
                    }

                    if (left < value && right > value) {
                        // Positive slope
                        const leftComplex = this.getComplexContainingPoint(leftIndex);
                        leftComplex.addPoints(indexes);
                        return;
                    }

                    if (left > value && right < value) {
                        // Negative slope
                        const rightComplex = this.getComplexContainingPoint(rightIndex);
                        rightComplex.addPoints(indexes);
                        return;
                    }
                });
            }
        }

        // Entire signal has died
        console.log('Complete');
        this.complexes.find(complex => !complex.isDead)!.dispose(threshold);
        this.history.push({ type: 'Death', threshold: this.max });

        console.log(this.complexes);
        console.log(this.history);
        const hrend = process.hrtime(hrstart);
        console.info('Execution time: %ds %dms', hrend[0], hrend[1] / 1000000)
    }
    public get persistence() {
        return this.complexes.map(c => c.persistence);
    }
}


// const signal = [5, 4, 5, 6, 7, 8, 7, 7, 6, 3, 2, 0];

// console.log('signal', signal);
// const ph = new PersistentHomology(signal);
// ph.execute();
// console.log(ph.persistence);

// const signal2 = [-0.36,1.00,5.03,4.11,1.42,0.49,2.80,1.04,0.25,1.07,2.04,-0.49,-0.89,-2.49,-0.87,-2.01,-0.20,-2.75,-1.03,2.70,1.19,3.02,1.76,-0.45,1.04,0.55,0.74,-0.35,2.45,1.77,-1.02,-1.48,-0.83,0.84,-2.72,0.03,1.34,0.93,0.81,-0.52,-1.55,-1.41,3.33,2.73,3.54,4.08,0.80,-0.82,-0.10,0.79,-3.53,2.20,-2.79,-0.02,-1.00,-5.18,-2.56,-0.41,1.01,-1.67,-1.66,3.84,0.95,-1.05,-0.87,-1.50,0.75,2.15,-2.05,-2.73,0.50,-1.13,1.63,-2.01,-1.92,-2.79,2.95,2.66,-0.31,-0.83,0.88,-3.15,-1.33,-0.79,0.91,6.68,-0.97,-2.08,3.31,-0.80,0.30,-2.87,-1.64,0.61,-0.58,2.99,0.30,-2.25,-2.76,-1.68,1.42,2.10,3.02,-0.94,0.04,2.38,-3.29,0.64,-1.89,2.39,0.31,4.23,-0.44,0.40,-3.82,-2.45,-0.45,-5.43,0.47,-0.69,-0.31,0.49,3.35,-2.83,-0.68,-0.43,0.44,2.22,2.72,0.51,-2.59,-2.68,0.34,-1.04,0.51,2.17,1.64,-3.24,0.92,-2.16,0.23,-1.50,1.31,-1.17,4.74,-1.65,-2.41,-2.32,-0.68,1.26,-0.00,1.00,-1.38,-0.50,0.46,3.22,-2.80,-4.59,-2.94,1.26,3.06,3.75,3.00,0.81,2.21,1.19,0.98,2.75,-0.64,-0.38,0.64,-1.21,-2.61,0.73,-2.17,0.76,-3.48,2.12,-0.78,-4.61,-1.82,-1.30,1.63,1.14,0.09,2.02,1.06,0.80,1.71,0.70,-4.06,1.86,1.83,0.07,-1.48,-0.53,-0.37,-4.31,-2.23,-0.89,1.23,2.83,3.84,4.83,-0.95,-1.98,2.36,-3.23,-1.48,2.83,-2.23,2.19,2.10,-3.15,0.10,-5.19,-2.46,-0.37,-0.17,1.46,0.90,1.82,-2.71,-1.42,2.81,1.62,1.86,1.54,4.08,4.54,-3.06,-0.71,1.26,0.04,-5.54,-1.29,-0.68,-0.71,1.76,2.95,0.01,1.59,3.14,0.39,0.27,1.57,1.62,-2.59,0.98,-0.89,-1.19,2.52,0.81,-0.46,-1.19,-1.99,0.36,-4.96,-1.62,-3.63,2.88,-1.69,-0.88,-1.78,1.86,-0.38,-0.29,-0.37,2.93,-1.60,-0.74,0.86,-4.44,-1.53,-2.30,2.79,2.29,0.46,1.04,-0.61,5.72,-1.16,-4.46,-0.87,0.24,-1.54,2.13,3.72,-0.99,-3.28,-2.42,-0.04,-0.42,-3.64,1.44,1.05,-4.41,-1.01,0.10,0.23,-0.84,2.72,-1.22,-2.61,2.81,0.33,1.05,-2.07,3.39,-0.48,2.28,-1.56,-2.04,-2.75,-2.13,-0.75,0.89,1.68,1.63,1.94,0.07,-1.11,-0.52,0.64,-1.21,4.04,4.50,3.13,2.22,-1.40,-5.46,-2.81,-3.97,0.72,3.07,0.84,-0.58,-2.22,-1.88,0.28,-1.01,3.49,-1.07,-3.98,1.93,-0.77,1.60,0.10,2.46,-4.14,0.91,1.86,-2.02,2.33,3.90,-0.89,0.43,-1.03,-3.70,1.41,-0.07,0.44,1.75,1.77,-3.55,3.00,1.57,0.34,3.19,-0.73,0.70,1.41,-1.90,-2.06,-3.11,-0.13,-0.57,0.04,3.79,0.92,-1.72,0.18,-4.30,-3.31,-0.10,-0.35,0.67,2.63,0.71,-4.36,-1.62,3.01,-1.69,-5.30,-4.07,-2.59,0.60,-2.59,-0.95,-1.29,-0.94,3.84,-1.52,-1.39,0.16,1.96,1.96,-4.33,1.28,-0.95,0.35,-3.24,-0.84,-2.72,-3.13,1.24,1.16,0.74,-2.01,-1.72,1.17,-3.84,-0.56,-1.97,0.71,-1.72,0.98,-2.03,1.31,-0.13,-4.08,-1.60,-1.06,-2.62,1.43,-1.13,-3.54,-0.96,-2.74,-2.57,-4.01,1.36,-2.11,1.13,1.05,2.34,-1.44,0.59,1.21,-0.96,-0.88,1.35,0.36,3.97,-0.29,-5.43,-0.27,-0.08,-2.84,-1.06,2.56,-0.86,-0.38,0.63,-2.58,0.21,0.07,4.30,2.12,-0.05,2.34,-1.34,0.92,-4.66,0.73,0.12,1.23,-0.41,1.83,-0.25,0.04,-2.10,1.07,0.17,2.71,3.10,-0.35,-1.64,-2.00,-2.56,-3.13,-2.38,-0.31,-1.20,2.24,0.53,1.48,-0.45,-0.12,0.24,-1.93,-0.52,1.23,0.99,2.46,-0.48,-2.44,0.41,0.68,5.67,3.74,1.87,2.10,-1.43,-5.08,0.59,-0.89,2.88,2.45,2.46,-0.10,1.85,-1.15,0.11,-0.15,1.35,6.04,1.28,0.38,2.97,-1.93,-1.27,-3.72,-0.17,0.85,1.39,0.23,1.03,-1.76,-4.58,-2.07,1.34,3.67,3.25,0.53,1.99,-1.64,1.00,0.24,-3.52,-0.62,3.74,-3.42,-1.11,-3.68,-3.39,-4.96,-0.67,-2.53,0.46,2.21,0.48,2.03,-0.23,-0.82,0.43,2.14,0.13,4.55,-1.29,-3.66,0.11,-5.82,-7.36,-1.67,-0.47,-0.82,-0.29,1.27,-1.05,-0.35,-1.60,-1.40,3.82,4.91,2.01,3.16,3.44,-3.13,-5.53,1.42,-0.61,-3.05,1.66,1.78,3.67,-1.23,-1.75,-3.69,-6.07,-1.42,3.18,-0.75,1.80,-2.17,3.01,2.24,-2.00,-1.95,2.63,3.08,2.51,0.01,-0.31,-0.63,-2.51,2.76,-2.19,-1.04,0.82,0.75,-2.08,-2.92,-1.90,-0.76,0.65,-1.25,0.15,0.23,-1.79,1.40,-0.17,-1.95,2.36,2.13,-0.03,2.29,-0.64,-1.73,-2.82,1.72,2.83,2.81,1.14,4.35,1.08,0.96,-0.27,-1.46,0.09,0.52,-1.56,0.89,5.49,0.45,1.65,-1.07,-2.18,-1.07,-2.58,-0.60,2.79,1.92,-0.15,5.30,3.27,0.13,0.54,2.60,0.13,2.76,0.14,-0.19,-3.95,-1.04,-0.04,-2.71,-1.99,-1.87,1.37,0.84,-4.34,-0.19,-2.93,1.19,2.45,-2.37,3.59,-0.09,-3.10,3.92,3.14,0.60,-0.11,2.31,1.66,-5.64,-3.17,-4.30,-1.94,2.21,-2.10,0.52,2.68,-5.22,3.09,-4.51,-0.51,-0.31,0.97,2.32,-2.42,2.41,-1.00,-1.22,-4.03,-1.25,0.38,0.65,1.71,-1.86,-4.42,-0.55,-2.66,-0.24,1.42,-1.54,-2.02,-0.75,-1.41,-1.04,-1.77,0.78,-1.11,1.29,-0.28,-2.38,1.21,-2.25,-4.29,0.00,0.93,1.58,-0.09,1.69,-0.29,0.77,-1.12,0.79,-0.86,-0.96,0.87,-1.99,-0.23,-2.89,-2.35,0.52,-0.95,-1.55,1.05,1.53,0.31,-1.74,3.79,-0.14,3.04,0.09,3.29,2.45,1.18,-2.61,-1.82,-1.88,0.40,0.47,-0.15,-0.13,1.46,-0.73,1.97,-2.03,-3.72,-0.69,-2.67,1.77,4.16,-1.23,-2.43,-0.45,-0.86,1.38,-0.06,0.69,-1.28,0.28,2.01,0.60,-1.86,-2.05,3.90,0.76,-0.34,0.54,1.67,3.52,-0.44,0.01,3.12,2.32,-0.25,-0.90,3.17,-0.09,-1.16,-4.32,-6.96,-2.91,2.52,-0.55,-0.94,-0.12,1.49,-1.91,-5.21,-1.47,2.93,4.02,3.88,2.12,0.70,-2.72,0.22,-2.79,0.13,-2.92,0.01,2.75,-0.82,0.03,-1.26,-1.79,0.24,-0.34,2.56,0.25,-0.32,-0.32,1.75,0.39,1.36,4.35,-0.25,-0.51,1.91,-0.91,-0.11,-0.17,0.24,-0.91,4.18,0.67,-1.89,-0.48,1.78,2.57,-0.96,3.64,1.10,0.20,3.24,-0.11,-2.76,-6.99,-0.09,-0.26,-2.67,-2.38,-4.02,-1.31,-1.24,1.24,-1.09,3.75,-1.03,-1.08,1.13,1.93,1.26,0.38,0.17,0.21,-1.36,-2.31,0.47,2.60,4.22,-1.08,-4.06,-4.64,-2.31,-2.59,0.23,-1.32,2.18,4.06,2.53,-0.02,0.49,-0.30,-1.53,-1.57,-0.67,0.42,-4.41,-2.35,-1.26,-0.33,0.91,4.73,-0.40,1.70,-3.13,1.52,-1.46,1.52,6.20,-0.31,0.89,4.71,3.20,0.29,-2.03,-2.83,-2.85,-1.83,0.81,0.81,3.13,-0.68,-0.06,-2.34,0.06,-1.83,2.85,-1.30,1.54,2.60,0.58,0.60,-1.44,-5.39,-0.50,1.38,-2.87,-2.18,2.01,-1.87,-1.27,-3.67,0.17,2.85,-2.41,-0.01,-0.43,0.53,2.44,3.61,1.86,4.35,-0.03,0.08,-2.60,3.29,-5.30,-0.42,-1.46,0.92,-2.73,-3.21,0.52,3.35,0.21,0.83,-1.14,1.81,0.41,0.21,-0.88,-0.65,1.03,3.51,-0.15,-0.48,-2.56,1.93,1.07,-2.55,0.36,1.25,-1.89,-0.05,3.89,0.88,2.47,-0.01,0.11,-4.38,-2.36,0.06,-0.77,-2.84,1.91,-1.00,0.57,-3.53,-6.13,1.87,-1.14,0.31,-0.58,-0.14,2.84,1.83,-1.86,0.93,-0.08,0.80,0.59,0.15,3.83,-0.91,0.34,-0.84,0.46,0.02,-0.54,0.03,4.02,-0.45,-2.41,-1.57,3.28,-1.73,1.11,0.08,-1.92,1.85,1.05,0.93,1.20,-0.97,1.16,-2.31,-4.12,-0.89,1.70,-4.56,-2.37,2.63,4.52,4.01,2.47,-0.08,1.42,-1.43,1.97,0.59,-1.04,1.48,2.98,3.77,-3.19,-2.68,-0.90,0.26,-0.15,-0.73,7.74,-3.13,3.36,-0.90,-3.23,-1.24,2.47,2.92,-2.23,3.20,1.79,2.15,2.68,-5.84,1.89,-1.60,-1.23,-1.44,0.32,-1.49,-0.60,-2.97,2.45,0.34,-1.35,1.83,1.11,2.95,-1.25,1.54,0.73,3.73,0.56,3.69,0.26,1.75,-3.43,-2.50,-1.57,0.07,-1.98,-0.49,-1.59,5.97,-1.44,-0.77,-3.90,-2.17,0.79,-0.31,2.21,3.37,-0.47,1.70,1.11,2.28,0.41,-0.09,4.23,1.68,-0.36,-1.63,-1.56,-1.46,-1.84,0.60,2.60,1.44,-0.78,-0.68,0.81,0.93,1.05,-1.62,-0.52,-1.92,-0.57,-2.62,-3.63,-0.18,-5.39,-1.20,1.53,0.94,1.57,1.45,6.24,-1.47,0.94,-2.16,2.81,2.72,3.19,-0.21,-1.19,0.60,-0.55,1.76,0.97,5.31,3.40,-2.33,-3.08,-1.54,-3.34,-1.00,2.63,3.60,0.33,4.24,2.11,-0.23,0.94,1.81,-1.33,-0.21,0.63,-0.42,0.85,0.20,1.21,-1.23,-2.43,-0.17,0.70,0.53,6.52,0.08,0.23,-1.62,-0.29,-0.58,0.85,1.47,0.10,0.54,4.45,0.84,-0.08,-3.02,1.05,2.69,-3.77,1.13,5.36,-2.30,-2.63,2.67,-2.37,0.43,2.28,0.50,0.13,-0.39,-2.22,-1.29,-3.04,-4.31,2.42,-3.67,-1.26,2.46,-5.64,-0.67,1.72,4.24,1.26,1.17,-2.79,1.07,-1.80,-2.12,0.18,-0.32,-0.75,-1.86,0.41,-2.29,-2.85,-0.87,1.16,-1.39,0.59,-0.01,1.15,-1.21,-1.60,-1.02,2.55,-1.36,-0.12,4.07,-0.85,1.76,-1.98,-1.30,-1.13,-0.05,-1.06,-1.32,-0.01,2.72,3.74,0.06,1.47,-2.09,0.89,3.44,1.82,0.80,-1.52,3.54,-0.26,0.61,2.64,-0.49,-1.36,0.16,-3.45,-2.74,-1.03,-1.77,2.49,1.54,1.24,2.28,1.97,1.31,0.04,-2.11,1.28,0.65,-1.56,-0.49,0.11,-1.87,-0.51,-1.39,-3.72,2.54,-4.32,-0.50,2.43,3.94,-2.01,-1.58,3.14,0.68,-1.20,1.92,-1.60,-1.95,1.51,-4.26,-1.96,1.15,-2.66,4.44,2.58,-3.01,1.77,-3.74,-3.39,2.89,1.76,4.72,3.92,2.19,4.37,-2.86,0.83,-1.46,-0.35,2.24,3.68,-0.40,-1.69,-0.97,0.17,-1.94,-1.60,0.81,-1.10,2.76,2.49,0.29,3.79,-3.91,2.67,0.13,-1.72,1.87,-1.16,5.38,0.91,-4.98,-3.07,-1.37,-1.64,1.04,-3.46,2.40,-3.30,-2.79,-2.28,4.66,-0.56,3.84,-0.37,1.37,4.08,-1.01,0.89,0.69,0.30,-2.10,-0.37,1.52,-0.86,-1.61,2.56,0.03,-0.21,-1.87,2.00,-1.95,2.88,2.09,0.50,2.81,-1.86,3.80,0.65,-0.07,3.96,-3.80,-3.26,-1.71,0.99,-0.07,0.62,-0.43,-5.57,-2.64,0.24,-0.36,1.84,1.04,2.33,2.16,0.86,2.11,1.61,-1.40,-0.62,0.52,-1.43,-1.83,4.20,-1.36,5.77,-0.50,-2.75,-2.19,-2.00,1.34,0.79,0.84,0.99,2.02,1.65,-2.12,-3.59,-2.36,-1.53,-0.78,-2.35,-1.84,-0.82,-0.41,-1.31,0.58,-1.50,-0.26,0.36,-0.84,-0.52,-0.56,-2.52,3.85,3.49,3.99,3.00,-1.03,0.48,-0.94,-0.57,1.87,-1.88,2.17,1.56,1.38,-0.39,-3.20,-1.62,-2.23,-0.40,4.71,-1.47,0.16,2.83,-2.44,1.68,0.41,1.40,3.12,2.08,-3.42,0.04,0.90,-7.14,-2.82,-1.17];

// console.log('signal2', signal2);
// const ph2 = new PersistentHomology(signal2);
// ph2.execute();

// const signal3 = [5, 5, 7, 9, 2, 0, 3, 3, 6, 7, 4, 6, 4, 5, -1, 4, 7, 4, 2];
// console.log('signal3', signal3);
// const ph3 = new PersistentHomology(signal3);
// ph3.execute();
// console.log(ph3.persistence);

const resolution = 0.1;

const signalA = [5, 4, 5, 6, 7, 8, 7, 7, 6, 3, 2, 0];

console.log('signal', signalA);
const phA = new PersistentHomology(signalA, resolution);
phA.execute();

const signalB = [5, 4, 5, 6, 7, 8, 7, 7.5, 6, 3, 2, 0];

console.log('signal', signalB);
const phB = new PersistentHomology(signalB, resolution);
phB.execute();


console.log(phA.persistence);
console.log(phB.persistence);

console.log('euclideanCompare');
console.log(euclideanCompare(phA.persistence, phB.persistence))

function euclideanCompare(source: number[][], target: number[][]) {
    if (target.length > source.length) {
        let temp = source;
        source = target;
        target = temp;
    }

    let averageDistance = 0;
    let totalDistance = 0;
    let maxDistance = 0;
    source.forEach(sourcePoint => {
        const distance = target.reduce<number>((distance, targetPoint) => {
            const euclideanDistance = Math.sqrt(
                Math.pow((sourcePoint[0] - targetPoint[0]), 2) +
                Math.pow((sourcePoint[1] - targetPoint[1]), 2)
            );
            return Math.min(euclideanDistance, distance);
        }, Infinity);
        maxDistance = Math.max(maxDistance, distance);
        totalDistance += distance
    });
    averageDistance = totalDistance / source.length;
    return {
        totalDistance, averageDistance, maxDistance
    }
}