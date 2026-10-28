-- The one shop that ships first. The redirect seed depends on this row existing.
insert into shops (slug, name, domain, locale, currency, vat_display)
values ('elektrodvorak', 'Elektro Dvořák', 'elektrodvorak.cz', 'cs', 'CZK', 'gross')
on conflict (slug) do nothing;
