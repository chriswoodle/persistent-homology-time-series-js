import { PersistentHomology, euclideanCompare } from '../';
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

