
const elementoTodoService = require('../../../services/elemento_to_do_service');

// - todoIndex: posizione nell'array todoCreati in to_do_loader, mi serve perchè ogni elemento deve "sapere" a quale todo appartiene
// - creatoDaEmail: uso l'email invece dell'utente_id, perché l'ID vero lo conosco solo dopo aver creato gli utenti
// - completato: se true, dopo la creazione l'elemento viene marcato completato (usato per testare il completamento automatico del Todo quando tutti gli elementi lo sono)

const elementoTodoData = [
    // Todo 0: "Preparare slide riunione"
    { todoIndex: 0, testo: 'Raccogliere dati vendite', posizione: 0, priorita: 'alta', creatoDaEmail: 'giulia.romano@gmail.com', completato: true },
    { todoIndex: 0, testo: 'Creare grafici riepilogativi', posizione: 1, priorita: 'alta', creatoDaEmail: 'giulia.romano@gmail.com', completato: false },
    { todoIndex: 0, testo: 'Rivedere con il team', posizione: 2, priorita: 'media', creatoDaEmail: 'giulia.romano@gmail.com', completato: false },

    // Todo 2: "Organizzare lista regali"
    { todoIndex: 2, testo: 'Fare lista invitati', posizione: 0, priorita: 'media', creatoDaEmail: 'giulia.romano@gmail.com', completato: true },
    { todoIndex: 2, testo: 'Scegliere regalo', posizione: 1, priorita: 'bassa', creatoDaEmail: 'giulia.romano@gmail.com', completato: true },

    // Todo 3: "Consegnare progetto database"
    { todoIndex: 3, testo: 'Completare schema ER', posizione: 0, priorita: 'alta', creatoDaEmail: 'andrea.bianchi@gmail.com', completato: true },
    { todoIndex: 3, testo: 'Scrivere query di esempio', posizione: 1, priorita: 'alta', creatoDaEmail: 'andrea.bianchi@gmail.com', completato: false },
    { todoIndex: 3, testo: 'Preparare presentazione', posizione: 2, priorita: 'media', creatoDaEmail: 'andrea.bianchi@gmail.com', completato: false },

    // Todo 6: "Prenotare visita di controllo"
    { todoIndex: 6, testo: 'Chiamare studio medico', posizione: 0, priorita: 'media', creatoDaEmail: 'francesca.colombo@gmail.com', completato: true },

    // Todo 8: "Fare la spesa condivisa"
    { todoIndex: 8, testo: 'Comprare frutta e verdura', posizione: 0, priorita: 'media', creatoDaEmail: 'valentina.santoro@gmail.com', completato: false },
    { todoIndex: 8, testo: 'Comprare detersivi', posizione: 1, priorita: 'bassa', creatoDaEmail: 'valentina.santoro@gmail.com', completato: false },

    // Todo 10: "Preparare offerta candidato"
    { todoIndex: 10, testo: 'Definire pacchetto retributivo', posizione: 0, priorita: 'alta', creatoDaEmail: 'lorenzo.gatti@gmail.com', completato: true },
    { todoIndex: 10, testo: 'Far firmare al legale', posizione: 1, priorita: 'alta', creatoDaEmail: 'lorenzo.gatti@gmail.com', completato: false },

    // Todo 12: "Pagare bolletta luce"
    { todoIndex: 12, testo: 'Verificare importo sul portale', posizione: 0, priorita: 'alta', creatoDaEmail: 'simone.barbieri@gmail.com', completato: true },
];

// Inserimento degli elementi To-do (ricevo todoCreati e utentiCreati, con gli ID veri)
async function inserisciElementiToDo(todoCreati, utentiCreati) {
    const elementiCreati = [];

    for (const dato of elementoTodoData) {
        const todo = todoCreati[dato.todoIndex];
        const creatore = utentiCreati.find(u => u.email === dato.creatoDaEmail);

        if (!todo) {
            throw new Error(`Todo non trovato all'indice: ${dato.todoIndex}`);
        }
        if (!creatore) {
            throw new Error(`Utente non trovato per email: ${dato.creatoDaEmail}`);
        }

        let elemento = await elementoTodoService.createElementoToDo(
            todo.id,
            dato.testo,
            dato.posizione,
            dato.priorita,
            creatore.id
        );

        // codice per attuare il completamento dell'elemento ed eventualmente il completamento di tutto il 
        // todo qualora l'elemento fosse l'ultimo rimasto incompleto della lista
        if (dato.completato) {
            elemento = await elementoTodoService.completaElementoToDo(elemento.id, true, creatore.id);
        }

        console.log(`Elemento creato: ${elemento.testo} (todo: ${todo.titolo}, completato: ${!!dato.completato})`);
        elementiCreati.push(elemento);
    }

    return elementiCreati;
}

module.exports = { inserisciElementiToDo, elementoTodoData };