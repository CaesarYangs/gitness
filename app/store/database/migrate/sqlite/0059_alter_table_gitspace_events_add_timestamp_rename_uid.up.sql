CREATE TABLE gitspace_events_temp
(
    geven_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    geven_event       TEXT    NOT NULL,
    geven_created     BIGINT  NOT NULL,
    geven_entity_type TEXT    NOT NULL,
    geven_query_key   TEXT,
    geven_entity_id   INTEGER NOT NULL,
    geven_timestamp   BIGINT  NOT NULL
);

INSERT INTO gitspace_events_temp (geven_id, geven_event, geven_created, geven_entity_type, geven_query_key,
                                  geven_entity_id, geven_timestamp)
SELECT geven_id,
       geven_event,
       geven_created,
       geven_entity_type,
       geven_entity_uid,
       geven_entity_id,
       geven_created * 1000000
FROM gitspace_events;

DROP TABLE gitspace_events;

ALTER TABLE gitspace_events_temp RENAME TO gitspace_events;

CREATE INDEX gitspace_events_entity_id ON gitspace_events (geven_entity_id);