
// Errore personalizzato che contiene anche il codice di risposta (es. 400, 403, 404)
class AppException extends Error {
    constructor(messaggio, status) {
        super(messaggio);
        this.status = status;
    }
}

module.exports = AppException;