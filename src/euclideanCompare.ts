export function euclideanCompare(source: number[][], target: number[][]) {
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