const formatoNumeroTelefono = (number) => {
    let formateado = number.replace(/\D/g, '');

    if (formateado.startsWith('0')) {
        formateado += '52' + formateado.substring(1);
    }

    if (!formateado.endsWith('@c.us')) {
        formateado += '@c.us';
    }

    return formateado;
}

export { formatoNumeroTelefono };