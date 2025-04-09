# Documento: Resumen Extendido y Ejemplos Detallados de Ejercicios de Direccionamiento IP

## 1\. Introducción a las Direcciones IP

- **¿Qué es una Dirección IP?**

  - Una dirección IP es un número de 32 bits que identifica de manera única un dispositivo en una red.
  - Se representa en formato decimal punteado, con 4 octetos separados por puntos (ej., 192.168.1.1).

- **Clases de Direcciones IP**

  - Las direcciones IP se dividen en clases (A, B, C, D, E) para facilitar la asignación y administración.
  - Cada clase tiene una estructura diferente que determina qué parte de la dirección identifica la red y qué parte identifica el host.
  - **Clase A**: Primer bit es 0.
  - **Clase B**: Los dos primeros bits son 10.
  - **Clase C**: Los tres primeros bits son 110. [cite: 25, 26]

## 2\. Máscaras de Subred

- **¿Qué es una Máscara de Subred?**

  - Una máscara de subred es una secuencia de 32 bits que se utiliza para dividir una dirección IP en la parte de red y la parte de host. [cite: 24, 620, 621]
  - Los bits a 1 en la máscara indican la parte de la dirección IP que corresponde a la red, y los bits a 0 indican la parte que corresponde al host. [cite: 25, 622, 623]

- **Máscaras por Defecto**

  - Cada clase de dirección IP tiene una máscara de subred por defecto:
    - Clase A: 255.0.0.0
    - Clase B: 255.255.0.0
    - Clase C: 255.255.255.0 [cite: 27]

## 3\. Subredes

- **¿Qué es Subredding?**

  - Subredding es el proceso de dividir una red IP en subredes más pequeñas. [cite: 128, 129, 130]
  - Se logra "tomando prestados" bits de la parte del host de la dirección IP y utilizándolos para la parte de subred.

- **Cálculos de Subredes**

  - **Número de Subredes**: 2^número de bits prestados
  - **Número de Hosts por Subred**: 2^número de bits de host disponibles - 2 (restamos la dirección de red y la de broadcast) [cite: 83, 131, 183, 184, 185, 186, 187]

## 4\. Bits en Subredes y Hosts

- **Bits Prestados**:

  - Son los bits que se toman de la parte del host para crear subredes.
  - Cada bit prestado duplica el número de subredes disponibles (2^bits prestados). [cite: 81, 82]

- **Bits de Host**:

  - Son los bits que quedan en la parte del host después de prestar bits para subredes.
  - Determinan el número de direcciones IP disponibles para los hosts en cada subred (2^bits de host - 2). (Se restan 2 para la dirección de red y broadcast). [cite: 83, 131]

## 5\. Cálculos Clave

- **Dirección de Red**: Se obtiene realizando una operación AND bit a bit entre la dirección IP y la máscara de subred. [cite: 27, 622, 623]
- **Dirección de Broadcast**: Es la última dirección IP en una subred, con la parte de host todos los bits a 1. [cite: 25]
- **Rango de Direcciones IP Válidas**: Las direcciones IP válidas para los hosts están entre la dirección de red + 1 y la dirección de broadcast - 1.

## 6\. Operación AND Bit a Bit

- La operación AND bit a bit compara cada bit de la dirección IP con el correspondiente bit de la máscara de subred.
- Si ambos bits son 1, el resultado es 1; de lo contrario, el resultado es 0.
  - Ejemplo:
    - IP: 11000000.10101000.00001010.00001010 (192.168.10.10)
    - Máscara: 11111111.11111111.11111111.00000000 (255.255.255.0)
    - Resultado: 11000000.10101000.00001010.00000000 (192.168.10.0) (Dirección de Red) [cite: 24, 25, 27, 6]

## 7\. Conversión Binario - Decimal y Decimal - Binario

- **Decimal a Binario**:
  1.  Dividir el número decimal entre 2.
  2.  Anotar el residuo (0 o 1).
  3.  Continuar dividiendo el cociente entre 2 hasta que el cociente sea 0.
  4.  Leer los residuos en orden inverso para obtener el número binario.
      - Ejemplo: 55 a binario
        - 55 / 2 = 27, residuo 1
        - 27 / 2 = 13, residuo 1
        - 13 / 2 = 6, residuo 1
        - 6 / 2 = 3, residuo 0
        - 3 / 2 = 1, residuo 1
        - 1 / 2 = 0, residuo 1
        - Binario: 110111
- **Binario a Decimal**:
  1.  Asignar un valor posicional a cada bit, comenzando desde la derecha con 2^0, luego 2^1, 2^2, etc.
  2.  Multiplicar el valor de cada bit (0 o 1) por su valor posicional.
  3.  Sumar los resultados.
      - Ejemplo: 110111 a decimal
        - 1\*2^5 + 1\*2^4 + 0\*2^3 + 1\*2^2 + 1\*2^1 + 1\*2^0 = 32 + 16 + 0 + 4 + 2 + 1 = 55 [cite: 611, 612, 613, 614, 615]

## 8\. Ejemplos de Ejercicios Detallados

**Ejercicio 1: Identificación de Clase, Dirección de Red, Broadcast, etc.**

- **Enunciado**: Dada la dirección IP 216.14.55.137, determina la clase, máscara por defecto, dirección de red, parte del host y dirección de broadcast. [cite: 22, 23, 24]
- **Solución**:

  1.  **Clase**:
      - Pasamos la IP a binario: 11011000.00001110.00110111.10001001
      - Los primeros bits son 110, por lo tanto, es Clase C. [cite: 25, 26]
      - _Lógica_: La Clase C se identifica porque los tres primeros bits son 110.
  2.  **Máscara por Defecto**:
      - Clase C usa los 3 primeros octetos para la red, entonces la máscara es: 11111111.11111111.11111111.00000000
      - En decimal: 255.255.255.0 [cite: 27]
      - _Lógica_: La máscara por defecto de Clase C es 255.255.255.0, lo que significa que los primeros tres octetos identifican la red.
  3.  **Dirección de Red**:
      - Se calcula haciendo AND entre la IP y la máscara, o poniendo la parte de host a 0: 11011000.00001110.00110111.00000000
      - En decimal: 216.14.55.0 [cite: 27]
      - _Lógica_: La dirección de red se obtiene al poner todos los bits de host en 0.
  4.  **Parte del Host**:
      - Es el último octeto en Clase C: 10001001
      - En decimal: 137 [cite: 6]
      - _Lógica_: En Clase C, el último octeto identifica al host dentro de la red.
  5.  **Dirección de Broadcast**:
      - Se obtiene poniendo la parte del host a 1: 11011000.00001110.00110111.11111111 [cite: 25, 28]
      - En decimal: 216.14.55.255
      - _Lógica_: La dirección de broadcast se obtiene al poner todos los bits de host en 1.

**Ejercicio 2: Subredding Básico**

- **Enunciado**: Dada la red 192.168.1.0/24, divídela en subredes utilizando la máscara 255.255.255.224. Determina cuántas subredes y hosts por subred se crean. [cite: 75, 76]
- **Solución**:

  1.  **Bits Prestados**:
      - Máscara en binario: 11111111.11111111.11111111.11100000 [cite: 81, 82]
      - Comparando con la máscara por defecto (255.255.255.0 o /24), vemos que se tomaron 3 bits para subredes.
      - _Lógica_: Se cuentan los bits adicionales a 1 en la nueva máscara respecto a la máscara por defecto.
  2.  **Número de Subredes**:
      - 2^3 = 8 subredes [cite: 81, 82]
      - _Lógica_: Cada bit prestado duplica el número de subredes.
  3.  **Hosts por Subred**:
      - Quedan 5 bits para host.
      - 2^5 - 2 = 32 - 2 = 30 hosts por subred (se resta 2 por la dirección de red y broadcast). [cite: 83]
      - _Lógica_: Los bits restantes determinan cuántos hosts pueden existir en cada subred. Se restan 2 direcciones (red y broadcast) que no se pueden asignar a hosts.
  4.  **Subredes Disponibles**:
      - 192.168.1.0, 192.168.1.32, 192.168.1.64, 192.168.1.96, 192.168.1.128, 192.168.1.160, 192.168.1.192, 192.168.1.224 [cite: 83, 84, 85, 87]
      - _Lógica_: Las subredes se calculan incrementando el último octeto en saltos del valor del cuarto octeto de la máscara (224), en este caso de 32 en 32.

**Ejercicio 3: Subredding Avanzado**

- **Enunciado**: Dada la red 172.20.0.0, crea al menos 3 subredes y completa la tabla con la información de cada subred (IP de subred, rango de IPs, broadcast). [cite: 152, 153]
- **Solución**:

  1.  **Clase**:
      - 172.20.0.0 es Clase B. [cite: 152, 153]
      - _Lógica_: La Clase B se identifica porque los dos primeros bits son 10.
  2.  **Máscara**:
      - Para crear al menos 3 subredes, necesitamos 2 bits (2^2 = 4).
      - Máscara: 255.255.192.0 o /18 (tomamos 2 bits del tercer octeto) [cite: 153, 154]
      - _Lógica_: Se determina cuántos bits se necesitan para el número requerido de subredes.
  3.  **Hosts por Subred**:
      - Quedan 14 bits para hosts (16 en el tercer y cuarto octeto, menos los 2 prestados).
      - 2^14 - 2 = 16382 hosts por subred. [cite: 154]
      - _Lógica_: Se calcula el número de hosts disponibles con los bits restantes.
  4.  **Subredes**:

      | Subred | IP subred    | Rango de IPs                  | Broadcast      |
      | :----- | :----------- | :---------------------------- | :------------- | ----------- |
      | 1      | 172.20.0.0   | 172.20.0.1 - 172.20.63.254    | 172.20.63.255  |
      | 2      | 172.20.64.0  | 172.20.64.1 - 172.20.127.254  | 172.20.127.255 |
      | 3      | 172.20.128.0 | 172.20.128.1 - 172.20.191.254 | 172.20.191.255 |
      | 4      | 172.20.192.0 | 172.20.192.1 - 172.20.255.254 | 172.20.255.255 | [cite: 154] |

      - _Lógica_: Se listan las subredes y sus rangos, incrementando según los bits prestados.

**Ejercicio 4: Diseño de Subredes**

- **Enunciado**: Se desea crear 6 subredes para conectar 64 máquinas a cada una de ellas a partir de la dirección IP de red 220.130.145.0 y máscara por defecto 255.255.255.0. [cite: 182, 183]
- **Solución**:

  1.  **Clase**:
      - 220.130.145.0 es Clase C. [cite: 165]
      - _Lógica_: La Clase C se identifica porque los tres primeros bits son 110.
  2.  **Bits para Subredes**:
      - Para 6 subredes, necesitamos 3 bits (2^3 = 8, suficiente para 6). [cite: 183, 184, 185]
      - _Lógica_: Se calcula cuántos bits se necesitan para el número deseado de subredes.
  3.  **Hosts por Subred**:
      - Quedan 5 bits para hosts.
      - 2^5 - 2 = 30 hosts (insuficiente para 64 máquinas). [cite: 186, 187]
      - _Lógica_: Se calcula el número máximo de hosts por subred y se compara con el requerimiento.
  4.  **Conclusión**:
      - No es posible cumplir el requerimiento con una Clase C. Se necesitaría una Clase B o superredding para tener suficientes hosts por subred.
      - _Lógica_: Se determina si la clase de
