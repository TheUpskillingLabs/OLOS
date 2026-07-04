-- Retire the Learning Library placeholder items (owner decision, July
-- 2026): the library launches empty with a Coming Soon state until real
-- resources exist. 00034 stays in the chain as history; this forward
-- delete runs after it, so a fresh chain (e.g. the prod promotion) also
-- ends with zero resources. Nothing references resources by FK.
DELETE FROM resources;
