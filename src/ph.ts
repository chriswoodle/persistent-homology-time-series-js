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

export class PersistentHomology {
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