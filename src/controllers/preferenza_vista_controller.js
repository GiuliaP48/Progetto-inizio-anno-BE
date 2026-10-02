
const preferenzaVistaService = require('../services/preferenza_vista_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// PUT /preferenze-vista/imposta/:calendarioId
async function setPreferenzaVista(req, res) {
    try {
        const { vista } = req.body;

        const preferenza = await preferenzaVistaService.setPreferenzaVista(req.params.calendarioId, vista, req.utente_id);

        res.status(200).json(preferenza);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'impostazione della preferenza vista');
    }
}

// GET /preferenze-vista/visualizza/:calendarioId
async function getPreferenzaVista(req, res) {
    try {
        const preferenza = await preferenzaVistaService.getPreferenzaVista(req.params.calendarioId, req.utente_id);
        res.status(200).json(preferenza);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero della preferenza vista');
    }
}

module.exports = {
    setPreferenzaVista,
    getPreferenzaVista,
};