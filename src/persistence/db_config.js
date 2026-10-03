
// Connessione al database, unica e condivisa da tutti i repository
const { PrismaClient } = require('../../generated/prisma');

const prisma = new PrismaClient();

module.exports = prisma;
