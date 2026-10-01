
const AppException = require('../eccezioni/app_eccezioni');

const preferenzaVistaRepository = require('../repository/preferenza_vista_repository');
const calendarioRepository = require('../repository/calendario_repository');

const calendarioService = require('./calendario_service');

// Valori ammessi dall'enum TipoFrequenzaEstesa
const VISTE_VALIDE = ['giornaliera', 'settimanale', 'mensile', 'annuale'];

// Vista usata quando né l'utente né l'amministratore ne hanno scelta una
const VISTA_PREDEFINITA = 'mensile';

// Imposta o aggiorna la preferenza vista di un utente per un calendario
async function setPreferenzaVista(calendario_id, vista, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    // Vincoli sulla vista
    if (!vista) {
        throw new AppException('La vista è obbligatoria: usa giornaliera, settimanale, mensile o annuale', 400);
    }

    if (!VISTE_VALIDE.includes(vista)) {
        throw new AppException('Vista non valida: usa giornaliera, settimanale, mensile o annuale', 400);
    }

    const preferenzaEsistente = await preferenzaVistaRepository.getPreferenzaVista(utente_id, calendario_id);

    if (preferenzaEsistente) {
        await preferenzaVistaRepository.updatePreferenzaVista(utente_id, calendario_id, vista);
    } else {
        await preferenzaVistaRepository.createPreferenzaVista({
            utente_id,
            calendario_id,
            vista,
        });
    }

    // Risponde con la stessa forma della GET (vista, origine e vista_calendario)
    return getPreferenzaVista(calendario_id, utente_id);
}

// Recupera la preferenza vista di un utente per un calendario, con ereditarietà dall'amministratore.
// origine indica da dove arriva la vista: 'propria' (scelta dall'utente), 'amministratore' (ereditata) oppure 'predefinita' (nessuno ha scelto niente).
async function getPreferenzaVista(calendario_id, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    const preferenzaAmministratore = await preferenzaVistaRepository.getPreferenzaVista(
        calendario.utente_id,
        calendario_id
    );

    // vista_calendario è la vista "ufficiale" del calendario (quella dell'amministratore, o la predefinita):
    // serve a chi ha scelto una vista propria per sapere qual è quella del calendario ed eventualmente copiarla.
    const vistaCalendario = preferenzaAmministratore ? preferenzaAmministratore.vista : VISTA_PREDEFINITA;

    const preferenzaPropria = await preferenzaVistaRepository.getPreferenzaVista(utente_id, calendario_id);

    if (preferenzaPropria) {
        return { vista: preferenzaPropria.vista, origine: 'propria', vista_calendario: vistaCalendario };
    }

    if (preferenzaAmministratore) {
        return { vista: vistaCalendario, origine: 'amministratore', vista_calendario: vistaCalendario };
    }

    return { vista: VISTA_PREDEFINITA, origine: 'predefinita', vista_calendario: vistaCalendario };
}

module.exports = {
    setPreferenzaVista,
    getPreferenzaVista,
};