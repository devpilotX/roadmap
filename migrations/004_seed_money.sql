-- ------------------------------------------------------------------
-- 004_seed_money.sql | The money hour
--
-- Source: Part 17 in full, 17.1 to 17.14.
-- GENERATED FILE. Do not edit by hand.
-- Regenerate with: node scripts/seed-from-md.mjs
-- ------------------------------------------------------------------
SET NAMES utf8mb4;
SET SESSION sql_mode = CONCAT(@@sql_mode, ",STRICT_ALL_TABLES");

-- money_rules: 12 rows
INSERT INTO `money_rules` (`id`, `group_key`, `ord`, `rule`) VALUES
  (1, 'survivable', 1, 'The money hour never borrows from study. If client work overruns, the client waits two days. The roadmap does not wait one hour.'),
  (2, 'survivable', 2, 'You only sell what you can deliver **today**, with the machine and the tools you already run. Nothing you sell depends on a skill you are still learning this week.'),
  (3, 'survivable', 3, 'Fixed scope, fixed price, fixed delivery date. No hourly work. No open ended work. No \"we will see how it goes\".'),
  (4, 'survivable', 4, 'Fifty per cent advance before you start. No advance, no work. This is not rude, it is how every shop in Patna already operates.'),
  (5, 'survivable', 5, 'Client work is cash, not portfolio. The four projects in Part 5 are the portfolio. Never mix the two, never let a client repo replace a project repo.'),
  (6, 'protection', 1, 'Fifty per cent advance, always, by UPI or bank transfer. Screenshot goes in the tracker before you open the editor.'),
  (7, 'protection', 2, 'Scope written in one WhatsApp message and confirmed with a yes before work starts. That message is your contract.'),
  (8, 'protection', 3, 'Two revision rounds included. The third round is Rs 1,000. Say this at quote time, not at delivery time.'),
  (9, 'protection', 4, 'Quote a delivery date two days later than your real plan. Deliver early. Early delivery is the cheapest reputation you will ever buy.'),
  (10, 'protection', 5, 'Never hand over hosting access, domain access or source files before the final payment clears.'),
  (11, 'protection', 6, 'No client gets your study hours. If someone demands a call at 10:00, the answer is: I am free after 5 pm, sir.'),
  (12, 'protection', 7, 'Keep every rupee in one account and log it the same day. You cannot fix a number you never wrote down.')
ON DUPLICATE KEY UPDATE
  `group_key` = VALUES(`group_key`),
  `ord` = VALUES(`ord`),
  `rule` = VALUES(`rule`);

-- money_lanes: 3 rows
INSERT INTO `money_lanes` (`id`, `ord`, `lane`, `what_it_is`, `time_to_first_rupee`, `ceiling`, `use_it_for`) VALUES
  (1, 1, 'Lane 1, local', 'Patna businesses: coaching institutes, clinics, gyms, salons, wholesalers, CA and tax practices, property dealers, contractors, small schools', '7 to 21 days', 'Moderate', 'Breaking zero, cash in hand, referrals'),
  (2, 2, 'Lane 2, remote', 'Small remote gigs from platforms and communities', '21 to 60 days', 'High', 'Better rates once you have three delivered jobs with proof'),
  (3, 3, 'Lane 3, recurring', 'Care plans on everything you deliver: hosting, edits, backups, uptime', '30 to 45 days', 'The floor under everything', 'This is the lane that actually ends the panic')
ON DUPLICATE KEY UPDATE
  `ord` = VALUES(`ord`),
  `lane` = VALUES(`lane`),
  `what_it_is` = VALUES(`what_it_is`),
  `time_to_first_rupee` = VALUES(`time_to_first_rupee`),
  `ceiling` = VALUES(`ceiling`),
  `use_it_for` = VALUES(`use_it_for`);

-- offers: 8 rows
INSERT INTO `offers` (`code`, `ord`, `name`, `scope`, `delivery`, `price_band_text`, `price_low`, `price_high`, `is_recurring`, `unlocked_from_week`) VALUES
  ('O1', 1, 'One page site', 'Single page, mobile first, photos, map, call and WhatsApp buttons, hosted on your VPS, their domain or a subdomain', '72 hours', 'Rs 2,500 to Rs 6,000', 2500, 6000, 0, NULL),
  ('O2', 2, 'Business site', 'Up to 5 pages, enquiry form to WhatsApp and email, Google Maps, gallery, basic on page SEO, SSL', '5 days', 'Rs 8,000 to Rs 18,000', 8000, 18000, 0, NULL),
  ('O3', 3, 'Google presence fix', 'Google Business Profile set up or cleaned, photos, hours, categories, review link card, posts for one month', '3 days', 'Rs 3,000 to Rs 7,000', 3000, 7000, 0, NULL),
  ('O4', 4, 'Lead automation', 'Form or WhatsApp lead lands in a sheet, auto reply within 60 seconds, daily digest to the owner, built in n8n on your box', '4 days', 'Rs 6,000 to Rs 15,000', 6000, 15000, 0, NULL),
  ('O5', 5, 'Document automation', 'Invoice, fee receipt, quotation or report generated from a sheet or form, PDF out, mailed or sent on WhatsApp', '5 days', 'Rs 8,000 to Rs 20,000', 8000, 20000, 0, NULL),
  ('O6', 6, 'Reconciliation job', 'A one off data clean up or match between two files, the same shape as Project 1, delivered as a file plus a short video walkthrough', '3 days', 'Rs 5,000 to Rs 15,000', 5000, 15000, 0, NULL),
  ('O7', 7, 'Answering assistant', 'A retrieval assistant over the business\'s own documents, fees, courses, price list, policies, answered on a page or on WhatsApp', '7 days, from Week 17 only', 'Rs 20,000 to Rs 45,000', 20000, 45000, 0, 17),
  ('O8', 8, 'Care plan', 'Hosting, SSL, backups, uptime check, up to 2 content edits a month, 48 hour response', 'Monthly', 'Rs 1,200 to Rs 3,000 per month', 1200, 3000, 1, NULL)
ON DUPLICATE KEY UPDATE
  `ord` = VALUES(`ord`),
  `name` = VALUES(`name`),
  `scope` = VALUES(`scope`),
  `delivery` = VALUES(`delivery`),
  `price_band_text` = VALUES(`price_band_text`),
  `price_low` = VALUES(`price_low`),
  `price_high` = VALUES(`price_high`),
  `is_recurring` = VALUES(`is_recurring`),
  `unlocked_from_week` = VALUES(`unlocked_from_week`);

-- money_hour_shape: 6 rows
INSERT INTO `money_hour_shape` (`id`, `ord`, `day_name`, `first_forty`, `last_twenty`) VALUES
  (1, 1, 'Mon', '15 first touches from the week\'s list of 60', 'Update pipeline, log every touch'),
  (2, 2, 'Tue', '15 first touches, plus follow up 1 to Monday\'s list', 'Update pipeline, log'),
  (3, 3, 'Wed', '10 first touches, plus book or hold 2 calls', 'Send any quote that is pending, log'),
  (4, 4, 'Thu', 'Delivery only. The current paid job, nothing else', 'Message the client one progress line, log'),
  (5, 5, 'Fri', 'Delivery, then invoice, then payment follow up', 'Send the delivery message and the review request, log'),
  (6, 6, 'Sat', 'Proposals, price replies, referral asks, and build next week\'s list of 60 leads', 'Weekly money review, 10 minutes, numbers only')
ON DUPLICATE KEY UPDATE
  `ord` = VALUES(`ord`),
  `day_name` = VALUES(`day_name`),
  `first_forty` = VALUES(`first_forty`),
  `last_twenty` = VALUES(`last_twenty`);

-- lead_sources: 5 rows
INSERT INTO `lead_sources` (`id`, `ord`, `source`) VALUES
  (1, 1, 'Google Maps, searched by category plus locality: coaching institute Boring Road, dental clinic Kankarbagh, gym Patliputra, property dealer Rajendra Nagar, CA firm Exhibition Road, and so on. Record: name, category, phone, whether a website exists, whether the site is broken on mobile, Google rating, number of reviews.'),
  (2, 2, 'JustDial and IndiaMART listings for the same categories.'),
  (3, 3, 'Instagram business accounts in Patna with a phone number in bio and no link, or a dead link.'),
  (4, 4, 'Local Facebook groups and WhatsApp business groups.'),
  (5, 5, 'Every shop board you walk past that has a phone number and no website.')
ON DUPLICATE KEY UPDATE
  `ord` = VALUES(`ord`),
  `source` = VALUES(`source`);

-- money_scripts: 8 rows
INSERT INTO `money_scripts` (`id`, `code`, `ord`, `channel`, `title`, `body`, `version`, `is_original`) VALUES
  (1, 'S1', 1, 'whatsapp', 'WhatsApp, first touch.', 'Hello sir, I am Dipanshu from Patna. I make websites and automation for local businesses. I checked [Business name] on Google, your reviews are good but the website is not opening properly on mobile. I can make a new one page site with call button, WhatsApp button and location, ready in 3 days, Rs 4,000. Should I send you 2 samples?', 1, 1),
  (2, 'S2', 2, 'email', 'Cold email, subject line first.', 'Subject: [Business name] website opens broken on phone\n\nHello sir,\n\nI am Dipanshu, I build websites and small automations, I am based in Patna.\n\nI opened your website on my phone today. The menu does not work and the contact number is not clickable. Most of your customers are searching on a phone, so this is losing you calls.\n\nI can fix it in 3 days for Rs 4,000, or build a new 5 page site for Rs 12,000. Both include SSL, hosting for one year, and a WhatsApp enquiry button.\n\nHere are two samples: [link], [link]\n\nIf you want, I can send a 2 minute video showing exactly what is broken.\n\nThank you,\nDipanshu Kumar\n8102571038', 1, 1),
  (3, 'S3', 3, 'message', 'Follow up 1, 48 hours later, one line.', 'Sir, just checking, should I send the 2 minute video of what is broken on your site?', 1, 1),
  (4, 'S4', 4, 'message', 'Follow up 2, four days later, one line.', 'Sir, I am taking only 2 new projects this month. If this is not the right time, no problem, I will close the file.', 1, 1),
  (5, 'S5', 5, 'message', 'Follow up 3, ten days later, then stop.', 'Sir, last message from my side. If you ever need the site or the WhatsApp automation, my number is saved. Thank you.', 1, 1),
  (6, 'S6', 6, 'message', 'Price message, after they ask the rate.', 'Sir, Rs 12,000 total. Rs 6,000 advance to start, Rs 6,000 after you approve it. Delivery in 5 working days. Included: 5 pages, mobile design, enquiry form to your WhatsApp, Google map, SSL, and hosting for 1 year. After that Rs 1,500 per month if you want me to maintain it, or you can take the files.', 1, 1),
  (7, 'S7', 7, 'message', 'Delivery message.', 'Sir, the site is live: [url]. Please open it on your phone and check the WhatsApp button. Two rounds of changes are included, please send everything in one list. Invoice attached, balance Rs 6,000 on this UPI: [upi id].', 1, 1),
  (8, 'S8', 8, 'message', 'Referral ask, three days after payment.', 'Sir, thank you. If any of your friends in business needs the same, please give them my number. If they take it, I will do your next year hosting free.', 1, 1)
ON DUPLICATE KEY UPDATE
  `code` = VALUES(`code`),
  `ord` = VALUES(`ord`),
  `channel` = VALUES(`channel`),
  `title` = VALUES(`title`),
  `body` = VALUES(`body`),
  `version` = VALUES(`version`),
  `is_original` = VALUES(`is_original`);

-- money_refuse: 6 rows
INSERT INTO `money_refuse` (`id`, `ord`, `item`) VALUES
  (1, 1, 'Equity, revenue share, or \"build it first and we will pay if we like it\".'),
  (2, 2, 'Anyone who wants a marketplace, a full app, or \"something like Zomato\" for under Rs 50,000.'),
  (3, 3, 'Anyone who wants daily calls, daily meetings, or a WhatsApp group with five decision makers.'),
  (4, 4, 'Paid lead platforms, paid connects, paid \"training\" and any franchise or reseller pitch.'),
  (5, 5, 'Any job that needs a skill you have not shipped once already.'),
  (6, 6, 'Work for relatives at zero price. Family rate is fifty per cent, not free. Free work confirms exactly the story you are trying to break.')
ON DUPLICATE KEY UPDATE
  `ord` = VALUES(`ord`),
  `item` = VALUES(`item`);

-- money_month_targets: 6 rows
INSERT INTO `money_month_targets` (`id`, `ord`, `month_label`, `target_text`, `target_low`, `target_high`, `what_produces_it`, `is_total`) VALUES
  (1, 1, 'September 2026', '0 to 8,000', 0, 8000, 'First 2 samples built, 300 touches, first small job', 0),
  (2, 2, 'October 2026', '12,000 to 20,000', 12000, 20000, 'Two O2 sites or one site plus one O4 automation, first care plan signed', 0),
  (3, 3, 'November 2026', '20,000 to 30,000', 20000, 30000, 'Referrals begin, 3 care plans active', 0),
  (4, 4, 'December 2026', '25,000 to 40,000', 25000, 40000, 'One O5 or O6 job, 5 care plans active', 0),
  (5, 5, 'January 2027', '30,000 to 50,000', 30000, 50000, 'One O7 assistant sold after Week 17, care plans carry the base', 0),
  (6, 6, 'Five month total', '87,000 to 148,000', 87000, 148000, 'Plus Rs 6,000 to Rs 15,000 per month recurring going into February', 1)
ON DUPLICATE KEY UPDATE
  `ord` = VALUES(`ord`),
  `month_label` = VALUES(`month_label`),
  `target_text` = VALUES(`target_text`),
  `target_low` = VALUES(`target_low`),
  `target_high` = VALUES(`target_high`),
  `what_produces_it` = VALUES(`what_produces_it`),
  `is_total` = VALUES(`is_total`);

-- money_buyback: 5 rows
INSERT INTO `money_buyback` (`id`, `ord`, `item`) VALUES
  (1, 1, 'Claude Pro. Anthropic moved to rupee pricing for India on 13 July 2026: Rs 2,399 a month on monthly billing, or Rs 2,000 a month on annual billing which is Rs 24,000 taken up front. Local taxes are included in those figures and the app store price can differ slightly from the website. Claude Max starts at Rs 11,999 a month and you do not need it. Verified 27 August 2026. Check the live price on the day you buy, not before.'),
  (2, 2, 'Domain renewals and any DNS or mail cost. Hosting is already free on the Oracle box.'),
  (3, 3, 'Food and household contribution. Hand it over in person once. It changes how the house talks to you.'),
  (4, 4, 'An emergency buffer of Rs 20,000 before any purchase that is not on this list.'),
  (5, 5, 'Interview clothes, one set, before the first onsite. Not before.')
ON DUPLICATE KEY UPDATE
  `ord` = VALUES(`ord`),
  `item` = VALUES(`item`);

-- money_gates: 4 rows
INSERT INTO `money_gates` (`code`, `ord`, `gate_date`, `condition_text`, `if_it_fails`) VALUES
  ('M1', 1, '2026-09-30', 'Two sample sites live, 300 touches logged, at least one paid job of any size', 'Drop to the Rs 2,500 one page offer and sell it to five businesses. Break the zero first, optimise later.'),
  ('M2', 2, '2026-11-15', 'Rs 25,000 received in total, 2 care plans active', 'Stop all Lane 2 activity, go local only, walk into 10 shops a week in person'),
  ('M3', 3, '2026-12-31', 'Rs 60,000 received in total, 4 care plans active', 'Keep the care plans, stop taking new one off jobs, protect Gate 4'),
  ('M4', 4, '2027-01-24', 'Rs 90,000 received in total, and the money hour has never once eaten a study block', 'If money time ate study time, the money hour is cancelled for February. The job is the priority.')
ON DUPLICATE KEY UPDATE
  `ord` = VALUES(`ord`),
  `gate_date` = VALUES(`gate_date`),
  `condition_text` = VALUES(`condition_text`),
  `if_it_fails` = VALUES(`if_it_fails`);

-- money_first_hour: 4 rows
INSERT INTO `money_first_hour` (`id`, `ord`, `step`) VALUES
  (1, 1, 'Minutes 0 to 10. Open a sheet called `leads.csv` with these columns: name, category, area, phone, website, mobile broken yes or no, rating, reviews, status, last touch date, next touch date, notes.'),
  (2, 2, 'Minutes 10 to 40. Search Google Maps for three categories in three Patna localities. Fill 30 rows. Do not judge, do not filter yet, just fill.'),
  (3, 3, 'Minutes 40 to 50. Pick the two worst websites on the list. These become your two free samples, built during the launch block, whether or not the owners ever reply.'),
  (4, 4, 'Minutes 50 to 60. Write the WhatsApp first touch message from 17.7 into a text file, with your two sample links left blank for now. Send nothing today.')
ON DUPLICATE KEY UPDATE
  `ord` = VALUES(`ord`),
  `step` = VALUES(`step`);

-- money_week_targets: 21 rows
INSERT INTO `money_week_targets` (`week_n`, `focus`, `target_text`, `target_low`, `target_high`) VALUES
  (1, 'Two sample sites finished and live. First 90 touches', '0', 0, 0),
  (2, '90 touches. First price conversations. Payment details ready, UPI QR saved', '0', 0, 0),
  (3, '90 touches. First quote sent. Sample video walkthrough recorded', '0 to 3,000', 0, 3000),
  (4, 'Close the first job at any price above Rs 2,500. Deliver it inside the hour', '3,000 to 8,000', 3000, 8000),
  (5, 'Deliver, collect, ask for the referral. Attach a care plan', '5,000 to 12,000', 5000, 12000),
  (6, '90 touches. Second job. Raise the floor price to Rs 4,000', '10,000 to 18,000', 10000, 18000),
  (7, 'Sell one O3 Google presence fix. It is the fastest cash on the sheet', '14,000 to 24,000', 14000, 24000),
  (8, 'First O4 lead automation, built in n8n on your box', '20,000 to 32,000', 20000, 32000),
  (9, '90 touches. Second care plan. Raise the site floor to Rs 6,000', '24,000 to 38,000', 24000, 38000),
  (10, 'One O2 business site at full price', '30,000 to 48,000', 30000, 48000),
  (11, 'Gate 2 week. Delivery only, no new outreach, protect the gate', '33,000 to 52,000', 33000, 52000),
  (12, 'Restart outreach. Third care plan. Ask every past client for one referral', '38,000 to 60,000', 38000, 60000),
  (13, 'One O5 document automation', '45,000 to 70,000', 45000, 70000),
  (14, '90 touches. Fourth care plan', '50,000 to 78,000', 50000, 78000),
  (15, 'Gate 3 week. Applications start. Money hour drops to follow ups only', '55,000 to 85,000', 55000, 85000),
  (16, 'Delivery and collection only. Interviews take priority from here', '60,000 to 92,000', 60000, 92000),
  (17, 'O7 becomes legal to sell. Quote one, do not oversell it', '68,000 to 105,000', 68000, 105000),
  (18, 'Deliver the O7 job. Record a walkthrough video, it doubles as portfolio', '75,000 to 118,000', 75000, 118000),
  (19, 'Fifth care plan. Stop taking new one off work', '80,000 to 130,000', 80000, 130000),
  (20, 'Mock interviews take priority. Money hour is admin only', '85,000 to 140,000', 85000, 140000),
  (21, 'Gate 4 week. Collect every outstanding rupee. Close the books', '90,000 to 148,000', 90000, 148000)
ON DUPLICATE KEY UPDATE
  `focus` = VALUES(`focus`),
  `target_text` = VALUES(`target_text`),
  `target_low` = VALUES(`target_low`),
  `target_high` = VALUES(`target_high`);
