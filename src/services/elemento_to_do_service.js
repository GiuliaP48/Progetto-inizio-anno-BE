
const AppException = require('../eccezioni/app_eccezioni');

const elementoTodoRepository = require('../repository/elemento_to_do_repository');
const todoRepository = require('../repository/to_do_repository');
const calendarioRepository = require('../repository/calendario_repository');
const utenteRepository = require('../repository/utente_repository');

const calendarioService = require('./calendario_service');

// Valori ammessi dall'enum Priorita
const PRIORITA_VALIDE = ['bassa', 'media', 'alta'];

// Ordinamenti ammessi per la lista
const ORDINI_VALIDI = ['posizione', 'alfabetico', 'data_creazione', 'priorita'];

const LUNGHEZZA_MASSIMA_TESTO = 200;

// Controlla i dati di un elemento e restituisce solo i campi ammessi
function validaElemento(dati, parziale = false) {
    const risultato = {};

    // In creazione il testo è obbligatorio
    if (!parziale && !dati.testo) {
        throw new AppException('Il testo è obbligatorio', 400);
    }

    // Vincoli sul testo
    if (dati.testo !== undefined) {
        if (typeof dati.testo !== 'string' || dati.testo.trim().length === 0) {
            throw new AppException('Il testo non può essere vuoto', 400);
        }

        const testo = dati.testo.trim();

        if (testo.length > LUNGHEZZA_MASSIMA_TESTO) {
            throw new AppException(`Il testo può avere al massimo ${LUNGHEZZA_MASSIMA_TESTO} caratteri`, 400);
        }

        risultato.testo = testo;
    }

    // Vincoli sulla priorità: è facoltativa, in modifica null la toglie
    if (dati.priorita !== undefined) {
        if (dati.priorita === null) {
            if (parziale) {
                risultato.priorita = null;
            }
        } else if (!PRIORITA_VALIDE.includes(dati.priorita)) {
            throw new AppException('Priorità non valida: usa bassa, media o alta', 400);
        } else {
            risultato.priorita = dati.priorita;
        }
    }

    // Vincoli sulla posizione: è facoltativa, se c'è deve essere un intero da 0 in su
    if (dati.posizione !== undefined) {
        if (!Number.isInteger(dati.posizione) || dati.posizione < 0) {
            throw new AppException('La posizione deve essere un numero intero maggiore o uguale a 0', 400);
        }

        risultato.posizione = dati.posizione;
    }

    return risultato;
}

// Prepara gli elementi per la risposta: nome e cognome di chi li ha creati, completati e modificati.
async function aggiungiDatiElementi(elementi) {
    const ids = new Set();
    elementi.forEach(elemento => {
        if (elemento.creato_da) ids.add(elemento.creato_da);
        if (elemento.completato_da) ids.add(elemento.completato_da);
        if (elemento.modificato_da) ids.add(elemento.modificato_da);
    });

    const utenti = await utenteRepository.getUtentiByIds([...ids]);
    const utentiPerId = new Map(utenti.map(utente => [utente.id, utente]));

    // Da un id restituisce utente_id, nome e cognome, oppure null se l'id non c'è
    function datiPersona(id) {
        if (!id) return null;
        const utente = utentiPerId.get(id);
        return {
            utente_id: id,
            nome: utente ? utente.nome : null,
            cognome: utente ? utente.cognome : null,
        };
    }

    return elementi.map(elemento => {
        const { completato_da, creato_da, creato_il, modificato_da, modificato_il, ...dati } = elemento;
        return {
            ...dati,
            completato_da: datiPersona(completato_da),
            creato_da: datiPersona(creato_da),
            creato_il,
            modificato_da: datiPersona(modificato_da),
            modificato_il,
        };
    });
}

// Aggiorna data_completamento del todo in base ai suoi elementi:
// la mette quando il todo diventa completo (tutti gli elementi fatti) e la toglie quando smette di esserlo.
// Se il todo era già completo la data non cambia, così resta il giorno in cui è stato finito.
async function verificaCompletamentoTodo(todo_id) {
    const todo = await todoRepository.getTodoById(todo_id);

    const tuttiCompletati = todo.elementi.length > 0
        && todo.elementi.every(elemento => elemento.completato);

    if (tuttiCompletati && !todo.data_completamento) {
        await todoRepository.updateTodo(todo_id, { data_completamento: new Date() });
    }

    if (!tuttiCompletati && todo.data_completamento) {
        await todoRepository.updateTodo(todo_id, { data_completamento: null });
    }
}

// Creazione di un nuovo elemento in un todo, verificando i permessi
async function createElementoToDo(todo_id, testo, posizione, priorita, utente_id) {
    const todo = await todoRepository.getTodoById(todo_id);

    if (!todo) {
        throw new AppException('Todo non trovato', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(todo.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a creare elementi in questo todo', 403);
    }

    const dati = validaElemento({ testo, posizione, priorita });

    // Se la posizione non è stata inviata, l'elemento va in fondo al suo todo
    let posizioneFinale = dati.posizione;
    if (posizioneFinale === undefined) {
        const ultimaPosizione = await elementoTodoRepository.getUltimaPosizione(todo_id);
        posizioneFinale = ultimaPosizione === null ? 0 : ultimaPosizione + 1;
    }

    const nuovoElemento = await elementoTodoRepository.createElementoToDo({
        testo: dati.testo,
        posizione: posizioneFinale,
        priorita: dati.priorita,
        todo_id,
        creato_da: utente_id,
    });

    // Un elemento nuovo non è completato: se il todo era completo, non lo è più
    await verificaCompletamentoTodo(todo_id);

    const [elementoCompleto] = await aggiungiDatiElementi([nuovoElemento]);
    return elementoCompleto;
}

// Visualizza tutti gli elementi di un todo, ordinati per posizione oppure nell'ordine scelto (solo amministratore e membri che hanno accettato)
async function getElementiToDoByTodo(todo_id, ordine, utente_id) {
    const todo = await todoRepository.getTodoById(todo_id);

    if (!todo) {
        throw new AppException('Todo non trovato', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(todo.calendario_id);

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    // Vincoli sull'ordinamento
    if (ordine !== undefined && !ORDINI_VALIDI.includes(ordine)) {
        throw new AppException('Ordine non valido: usa posizione, alfabetico, data_creazione o priorita', 400);
    }

    const elementi = await elementoTodoRepository.getElementiToDoByTodo(todo_id);

    switch (ordine) {
        case 'alfabetico':
            elementi.sort((primoElemento, secondoElemento) =>
                primoElemento.testo.localeCompare(secondoElemento.testo)
            );
            break;

        case 'data_creazione':
            elementi.sort((primoElemento, secondoElemento) =>
                new Date(primoElemento.creato_il) - new Date(secondoElemento.creato_il)
            );
            break;

        case 'priorita': {
            const valorePriorita = { alta: 0, media: 1, bassa: 2 };
            elementi.sort((primoElemento, secondoElemento) => {
                const prioritaPrimoElemento = valorePriorita[primoElemento.priorita] ?? 3;
                const prioritaSecondoElemento = valorePriorita[secondoElemento.priorita] ?? 3;

                if (prioritaPrimoElemento !== prioritaSecondoElemento) {
                    return prioritaPrimoElemento - prioritaSecondoElemento;
                }

                return new Date(primoElemento.creato_il) - new Date(secondoElemento.creato_il);
            });
            break;
        }

        case 'posizione':
        default:
            elementi.sort((primoElemento, secondoElemento) =>
                primoElemento.posizione - secondoElemento.posizione
            );
    }

    return aggiungiDatiElementi(elementi);
}

// Modifica di un elemento, verificando i permessi: si possono cambiare solo testo, priorità e posizione
async function updateElementoToDo(id, dati, utente_id) {
    const elemento = await elementoTodoRepository.getElementoToDoById(id);

    if (!elemento) {
        throw new AppException('Elemento non trovato', 404);
    }

    const todo = await todoRepository.getTodoById(elemento.todo_id);
    const calendario = await calendarioRepository.getCalendarioById(todo.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a modificare questo elemento', 403);
    }

    const datiValidati = validaElemento(dati, true);

    if (Object.keys(datiValidati).length === 0) {
        throw new AppException('Nessun campo valido da modificare', 400);
    }

    const elementoAggiornato = await elementoTodoRepository.updateElementoToDo(id, {
        ...datiValidati,
        modificato_da: utente_id,
    });

    const [elementoCompleto] = await aggiungiDatiElementi([elementoAggiornato]);
    return elementoCompleto;
}

// Completa o decompleta un elemento, tracciando chi ha effettuato l'azione
async function completaElementoToDo(id, completato, utente_id) {
    const elemento = await elementoTodoRepository.getElementoToDoById(id);

    if (!elemento) {
        throw new AppException('Elemento non trovato', 404);
    }

    const todo = await todoRepository.getTodoById(elemento.todo_id);
    const calendario = await calendarioRepository.getCalendarioById(todo.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a modificare questo elemento', 403);
    }

    if (typeof completato !== 'boolean') {
        throw new AppException('completato deve essere true o false', 400);
    }

    const elementoAggiornato = await elementoTodoRepository.updateElementoToDo(id, {
        completato,
        completato_da: completato ? utente_id : null,
        modificato_da: utente_id,
    });

    await verificaCompletamentoTodo(elemento.todo_id);

    const [elementoCompleto] = await aggiungiDatiElementi([elementoAggiornato]);
    return elementoCompleto;
}

// Eliminazione di un elemento, verificando i permessi
async function deleteElementoToDo(id, utente_id) {
    const elemento = await elementoTodoRepository.getElementoToDoById(id);

    if (!elemento) {
        throw new AppException('Elemento non trovato', 404);
    }

    const todo = await todoRepository.getTodoById(elemento.todo_id);
    const calendario = await calendarioRepository.getCalendarioById(todo.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a eliminare questo elemento', 403);
    }

    await elementoTodoRepository.deleteElementoToDo(id);

    // Se era l'ultimo elemento non fatto, il todo diventa completo
    await verificaCompletamentoTodo(elemento.todo_id);
}

module.exports = {
    createElementoToDo,
    getElementiToDoByTodo,
    updateElementoToDo,
    completaElementoToDo,
    deleteElementoToDo
};