

FROM gcc:13.2


WORKDIR /app/


ARG FILE


COPY running/${FILE} .


RUN g++ ${FILE} -o program


CMD [ "timeout","5s","stdbuf","-oL","./program" ]   


