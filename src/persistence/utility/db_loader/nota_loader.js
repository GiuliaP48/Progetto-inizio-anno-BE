
const notaService = require('../../../services/nota_service');

// Funzione per inserire gli eventi in date diverse
function aggiungiGiorni(data, giorni) {
    const nuovaData = new Date(data);
    nuovaData.setDate(nuovaData.getDate() + giorni);
    return nuovaData;
}

// Trasformo una data nel formato AAAA-MM-GG richiesto dal service, usando il giorno italiano (non quello UTC)
function formatoData(data) {
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// - calendarioIndex posizione dell'array calendariCreati, mi serve perchè ogni nota deve "sapere" a quale calendario appartiene
// - creatoDaEmail e modificatoDaEmail: uso l'email invece dell'utente_id, perché l'ID vero lo conosco solo dopo aver creato gli utenti
// - offsetGiorni: giorni di distanza da oggi (ossia dal momento in cui lancio popola_db) per distanziare la creazione delle varie note (negativo = passato, positivo = futuro)
// - tipo: deve avere dei valori dell'enum TipoFrequenza (giornaliera | settimanale | mensile )

const notaData = [
    {
        testo: 'Ricordarsi di portare i documenti in riunione',
        offsetGiorni: 2,
        tipo: 'giornaliera',
        calendarioIndex: 0,
        creatoDaEmail: 'giulia.romano@gmail.com',
    },
    {
        testo: 'Comprare gli ingredienti per la cena di domenica',
        offsetGiorni: 4,
        tipo: 'settimanale',
        calendarioIndex: 1,
        creatoDaEmail: 'giulia.romano@gmail.com',
        modificatoDaEmail: 'giulia.romano@gmail.com',
        testoModificato: 'Comprare gli ingredienti per la cena di domenica (anche il dolce)',
    },
    {
        testo: 'Rivedere gli appunti prima della lezione',
        offsetGiorni: 1,
        tipo: 'mensile',
        calendarioIndex: 2,
        creatoDaEmail: 'andrea.bianchi@gmail.com',
    },
    {
        testo: 'Promemoria: aggiornare il relatore ogni settimana',
        offsetGiorni: 0,
        tipo: 'settimanale',
        calendarioIndex: 3,
        creatoDaEmail: 'andrea.bianchi@gmail.com',
    },
    {
        testo: 'Portare la tessera sanitaria dal dentista',
        offsetGiorni: -3,
        tipo: 'mensile',
        calendarioIndex: 4,
        creatoDaEmail: 'francesca.colombo@gmail.com',
    },
    {
        testo: 'Rinnovo abbonamento palestra a fine mese',
        offsetGiorni: 15,
        tipo: 'mensile',
        calendarioIndex: 5,
        creatoDaEmail: 'riccardo.fontana@gmail.com',
        modificatoDaEmail: 'riccardo.fontana@gmail.com',
        testoModificato: 'Rinnovo abbonamento palestra a fine mese (chiedere sconto annuale)',
    },
    {
        testo: 'Turno pulizie: controllare disponibilità prodotti',
        offsetGiorni: 3,
        tipo: 'settimanale',
        calendarioIndex: 6,
        creatoDaEmail: 'valentina.santoro@gmail.com',
    },
    {
        testo: 'Preparare domande per il colloquio tecnico',
        offsetGiorni: 2,
        tipo: 'giornaliera',
        calendarioIndex: 7,
        creatoDaEmail: 'lorenzo.gatti@gmail.com',
    },
    {
        testo: 'Controllare documenti di viaggio e assicurazione',
        offsetGiorni: 18,
        tipo: 'settimanale',
        calendarioIndex: 8,
        creatoDaEmail: 'martina.villa@gmail.com',
    },
    {
        testo: 'Verificare scadenze bollette ogni mese',
        offsetGiorni: -1,
        tipo: 'mensile',
        calendarioIndex: 9,
        creatoDaEmail: 'simone.barbieri@gmail.com',
    },
];

// Inserimento delle note (ricevo calendariCreati e utentiCreati con gli ID veri)
async function inserisciNote(calendariCreati, utentiCreati) {
    const noteCreate = [];
    const oggi = new Date();

    for (const dato of notaData) {
        const calendario = calendariCreati[dato.calendarioIndex];
        const creatore = utentiCreati.find(u => u.email === dato.creatoDaEmail);

        if (!calendario) {
            throw new Error(`Calendario non trovato all'indice: ${dato.calendarioIndex}`);
        }
        if (!creatore) {
            throw new Error(`Utente non trovato per email: ${dato.creatoDaEmail}`);
        }

        const data = formatoData(aggiungiGiorni(oggi, dato.offsetGiorni));

        let nota = await notaService.createNota(
            calendario.id,
            dato.testo,
            data,
            dato.tipo,
            creatore.id
        );

        // Alcune note, dopo essere state create, vengono anche modificate (hanno modificatoDaEmail nei dati sopra),
        // così nel frontend si vede anche "modificato da" e non solo "creato da"
        if (dato.modificatoDaEmail) {
            // Cerco chi fa la modifica tra gli utenti appena creati, tramite la sua email
            const modificatore = utentiCreati.find(utente => utente.email === dato.modificatoDaEmail);

            // Se l'email è scritta male non lo trovo: mi fermo con un errore chiaro
            if (!modificatore) {
                throw new Error(`Utente non trovato per email: ${dato.modificatoDaEmail}`);
            }

            // Cambio il testo della nota come se la modifica la facesse il "modificatore" dall'app (così viene salvato anche modificato_da)
            nota = await notaService.updateNota(
                nota.id,
                { testo: dato.testoModificato },
                modificatore.id
            );
        }

        console.log(`Nota creata: "${nota.testo.substring(0, 40)}..." (calendario: ${calendario.nome})`);
        noteCreate.push(nota);
    }

    return noteCreate;
}

module.exports = { inserisciNote, notaData };