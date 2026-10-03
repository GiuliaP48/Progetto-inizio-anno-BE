
const todoService = require('../../../services/to_do_service');

// Funzione per inserire gli elementi in date diverse
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

// - calendarioIndex posizione dell'array calendariCreati, mi serve perchè ogni todo deve "sapere" a quale calendario appartiene
// - creatoDaEmail e modificatoDaEmail: uso l'email invece dell'utente_id, perché l'ID vero lo conosco solo dopo aver creato gli utenti
// - offsetGiorni: giorni di distanza da oggi (ossia dal momento in cui lancio popola_db) per distanziare la creazione dei vari todo (negativo = passato, positivo = futuro)
// - tipo: deve avere dei valori dell'enum TipoFrequenza (giornaliera | settimanale | mensile )
// - priorita: deve avere dei valori nell'enum Priorita (bassa | media | alta) - opzionale
// - posizione: intero per l'ordinamento manuale dei todo all'interno del calendario

const todoData = [
    { titolo: 'Preparare slide riunione', calendarioIndex: 0, creatoDaEmail: 'giulia.romano@gmail.com', offsetGiorni: 1, tipo: 'giornaliera', priorita: 'alta', posizione: 0 },
    { titolo: 'Rispondere email clienti', calendarioIndex: 0, creatoDaEmail: 'giulia.romano@gmail.com', offsetGiorni: 0, tipo: 'giornaliera', priorita: 'media', posizione: 1 },
    { titolo: 'Organizzare lista regali', calendarioIndex: 1, creatoDaEmail: 'giulia.romano@gmail.com', offsetGiorni: 3, tipo: 'settimanale', priorita: 'bassa', posizione: 0 },
    { titolo: 'Consegnare progetto database', calendarioIndex: 2, creatoDaEmail: 'andrea.bianchi@gmail.com', offsetGiorni: 5, tipo: 'settimanale', priorita: 'alta', posizione: 0 },
    { titolo: 'Studiare per esame', calendarioIndex: 2, creatoDaEmail: 'andrea.bianchi@gmail.com', offsetGiorni: 2, tipo: 'giornaliera', priorita: 'alta', posizione: 1, modificatoDaEmail: 'andrea.bianchi@gmail.com', prioritaModificata: 'media' },
    { titolo: 'Correggere capitolo 3 tesi', calendarioIndex: 3, creatoDaEmail: 'andrea.bianchi@gmail.com', offsetGiorni: 6, tipo: 'settimanale', priorita: 'media', posizione: 0 },
    { titolo: 'Prenotare visita di controllo', calendarioIndex: 4, creatoDaEmail: 'francesca.colombo@gmail.com', offsetGiorni: -2, tipo: 'mensile', priorita: 'media', posizione: 0 },
    { titolo: 'Aggiornare piano allenamento', calendarioIndex: 5, creatoDaEmail: 'riccardo.fontana@gmail.com', offsetGiorni: 1, tipo: 'settimanale', priorita: 'bassa', posizione: 0 },
    { titolo: 'Fare la spesa condivisa', calendarioIndex: 6, creatoDaEmail: 'valentina.santoro@gmail.com', offsetGiorni: 2, tipo: 'settimanale', priorita: 'media', posizione: 0, modificatoDaEmail: 'valentina.santoro@gmail.com', prioritaModificata: 'alta' },
    { titolo: 'Pulire il frigorifero', calendarioIndex: 6, creatoDaEmail: 'valentina.santoro@gmail.com', offsetGiorni: 4, tipo: 'settimanale', priorita: 'bassa', posizione: 1 },
    { titolo: 'Preparare offerta candidato', calendarioIndex: 7, creatoDaEmail: 'lorenzo.gatti@gmail.com', offsetGiorni: 3, tipo: 'giornaliera', priorita: 'alta', posizione: 0 },
    { titolo: 'Organizzare valigie', calendarioIndex: 8, creatoDaEmail: 'martina.villa@gmail.com', offsetGiorni: 17, tipo: 'settimanale', priorita: 'media', posizione: 0 },
    { titolo: 'Pagare bolletta luce', calendarioIndex: 9, creatoDaEmail: 'simone.barbieri@gmail.com', offsetGiorni: -1, tipo: 'mensile', priorita: 'alta', posizione: 0 },
];

// Inserimento dei todo (ricevo calendariCreati e utentiCreati con gli ID veri)
async function inserisciTodo(calendariCreati, utentiCreati) {
    const todoCreati = [];
    const oggi = new Date();

    for (const dato of todoData) {
        const calendario = calendariCreati[dato.calendarioIndex];
        const creatore = utentiCreati.find(utente => utente.email === dato.creatoDaEmail);

        if (!calendario) {
            throw new Error(`Calendario non trovato all'indice: ${dato.calendarioIndex}`);
        }
        if (!creatore) {
            throw new Error(`Utente non trovato per email: ${dato.creatoDaEmail}`);
        }

        const dataOriginale = formatoData(aggiungiGiorni(oggi, dato.offsetGiorni));

        let todo = await todoService.createTodo(
            calendario.id,
            dato.titolo,
            dataOriginale,
            dato.tipo,
            dato.priorita,
            dato.posizione,
            creatore.id
        );

        // Alcuni todo, dopo essere stati creati, vengono anche modificati (hanno modificatoDaEmail nei dati sopra),
        // così nel frontend si vede anche "modificato da" e non solo "creato da"
        if (dato.modificatoDaEmail) {
            // Cerco chi fa la modifica tra gli utenti appena creati, tramite la sua email
            const modificatore = utentiCreati.find(utente => utente.email === dato.modificatoDaEmail);

            // Se l'email è scritta male non lo trovo: mi fermo con un errore chiaro
            if (!modificatore) {
                throw new Error(`Utente non trovato per email: ${dato.modificatoDaEmail}`);
            }

            // Cambio la priorità del todo come se lo facesse il "modificatore" dall'app (così viene salvato anche modificato_da)
            todo = await todoService.updateTodo(
                todo.id,
                { priorita: dato.prioritaModificata },
                modificatore.id
            );
        }

        console.log(`Todo creato: ${todo.titolo} (calendario: ${calendario.nome})`);
        todoCreati.push(todo);
    }

    return todoCreati;
}

module.exports = { inserisciTodo, todoData };