def validar_rnc(rnc: str) -> bool:
    rnc = rnc.replace('-', '').strip()
    if not rnc.isdigit() or len(rnc) != 9:
        return False
    digits = [int(d) for d in rnc]
    weights = [7, 9, 8, 6, 5, 4, 3, 2]
    suma = sum(d * w for d, w in zip(digits[:8], weights))
    resto = suma % 11
    check = 11 - resto if resto > 1 else 0
    return check == digits[8]


def formatear_rnc(rnc: str) -> str:
    rnc = rnc.replace('-', '').strip()
    if len(rnc) == 9:
        return f'{rnc[:3]}-{rnc[3:7]}-{rnc[7:9]}'
    return rnc
