-- WUPCare 0008: reference data. Not demo data: needed in every environment.
-- Spec: SYSTEM_SPEC.md §9.2 (categories), §8.9 (default clinic hours, Q-F5).

insert into public.health_concern_categories (name, sort_order) values
  ('Headache', 1),
  ('Fever', 2),
  ('Cough / Colds', 3),
  ('Stomach Ache / Gastrointestinal', 4),
  ('Dysmenorrhea', 5),
  ('Dizziness', 6),
  ('Wound / Minor Injury', 7),
  ('Allergy / Skin', 8),
  ('Toothache', 9),
  ('Other', 10)
on conflict (name) do nothing;

-- Mon-Fri, 08:00-17:00, 30 days ahead (column defaults) until Q-F5 is answered.
insert into public.clinic_settings (id) values (1)
on conflict (id) do nothing;
