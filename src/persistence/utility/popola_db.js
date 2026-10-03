
const utenteRepository = require('../../repository/utente_repository');

const { inserisciUtenti, utentiData } = require('./db_loader/utente_loader');
const { inserisciCalendari, inserisciMembri } = require('./db_loader/calendario_loader');
const { inserisciTag } = require('./db_loader/tag_loader');
const { inserisciNote } = require('./db_loader/nota_loader');
const { inserisciPreferenzeVista } = require('./db_loader/preferenza_vista_loader');
const { inserisciTodo } = require('./db_loader/to_do_loader');
const { inserisciElementiToDo } = require('./db_loader/elemento_to_do_loader');
const { inserisciEventi } = require('./db_loader/evento_loader');
const { inserisciNotifiche } = require('./db_loader/notifica_loader');

// Popolo il database con dati loader, rispettando l'ordine di dipendenza tra i modelli:
// utente --> calendario --> membri --> tag --> nota --> preferenzaVista --> todo --> elementoToDo --> evento --> notifica
// Dettagli:
// - i membri servono prima delle preferenze e degli eventi, perché un membro può avere una sua vista e un evento può stare in più calendari
// - evento deve venire dopo tag perché collega dei tag_ids
// - notifica deve venire dopo Evento perché le notifiche di avviso contengono l'id dell'evento (evento_id)

async function popolaDb() {
    try {
        // Il server riparte a ogni salvataggio e ogni volta chiama popolaDb():
        // controllo se Giulia (il primo utente demo) esiste già. Se sì, il seed è già stato fatto e mi fermo, così non creo doppioni
        const giaPopolato = await utenteRepository.getUtenteByEmail(utentiData[0].email);

        if (giaPopolato) {
            console.log("Il database è già popolato");
            return;
        }

        console.log("\n=== INSERIMENTO UTENTI ===");
        const utentiCreati = await inserisciUtenti();

        console.log("\n=== INSERIMENTO CALENDARI ===");
        const calendariCreati = await inserisciCalendari(utentiCreati);

        console.log("\n=== INSERIMENTO MEMBRI ===");
        await inserisciMembri(calendariCreati, utentiCreati);

        console.log("\n=== INSERIMENTO TAG ===");
        const tagCreati = await inserisciTag(calendariCreati, utentiCreati);

        console.log("\n=== INSERIMENTO NOTE ===");
        await inserisciNote(calendariCreati, utentiCreati);

        console.log("\n=== INSERIMENTO PREFERENZE VISTA ===");
        await inserisciPreferenzeVista(utentiCreati, calendariCreati);

        console.log("\n=== INSERIMENTO TODO ===");
        const todoCreati = await inserisciTodo(calendariCreati, utentiCreati);

        console.log("\n=== INSERIMENTO ELEMENTI TODO ===");
        await inserisciElementiToDo(todoCreati, utentiCreati);

        console.log("\n=== INSERIMENTO EVENTI ===");
        const eventiCreati = await inserisciEventi(calendariCreati, utentiCreati, tagCreati);

        console.log("\n=== INSERIMENTO NOTIFICHE ===");
        await inserisciNotifiche(utentiCreati, eventiCreati);

        console.log("\n=== DATABASE POPOLATO CON SUCCESSO! ===");

    } catch (e) {
        console.error("Errore durante il popolamento del database:", e);
    }
}

module.exports = popolaDb;