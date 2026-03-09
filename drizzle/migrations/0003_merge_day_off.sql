-- Merge day_off into vacation
UPDATE days SET day_type = 'vacation' WHERE day_type = 'day_off';
