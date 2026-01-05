--
-- PostgreSQL database dump
--

\restrict biueApsg8OAh1LGa4NDhGNt3KpQD5glGsbimbokPapbgW30X6KH1dSXo8bja4uN

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public.users DROP CONSTRAINT users_region_id_fkey;
ALTER TABLE ONLY public.records DROP CONSTRAINT records_region_id_fkey;
ALTER TABLE ONLY public.record_types DROP CONSTRAINT record_types_category_id_fkey;
ALTER TABLE ONLY public.codex_types DROP CONSTRAINT codex_types_category_id_fkey;
DROP INDEX public.idx_audit_user;
DROP INDEX public.idx_audit_date;
DROP INDEX public.idx_audit_action;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_username_key;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
ALTER TABLE ONLY public.system_settings DROP CONSTRAINT system_settings_pkey;
ALTER TABLE ONLY public.regions DROP CONSTRAINT regions_pkey;
ALTER TABLE ONLY public.regions DROP CONSTRAINT regions_code_key;
ALTER TABLE ONLY public.records DROP CONSTRAINT records_pkey;
ALTER TABLE ONLY public.record_types DROP CONSTRAINT record_types_pkey;
ALTER TABLE ONLY public.record_categories DROP CONSTRAINT record_categories_pkey;
ALTER TABLE ONLY public.record_categories DROP CONSTRAINT record_categories_name_key;
ALTER TABLE ONLY public.codex_types DROP CONSTRAINT codex_types_pkey;
ALTER TABLE ONLY public.codex_categories DROP CONSTRAINT codex_categories_pkey;
ALTER TABLE ONLY public.codex_categories DROP CONSTRAINT codex_categories_name_key;
ALTER TABLE ONLY public.audit_logs DROP CONSTRAINT audit_logs_pkey;
ALTER TABLE public.users ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE public.system_settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.regions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.records ALTER COLUMN record_id DROP DEFAULT;
ALTER TABLE public.record_types ALTER COLUMN type_id DROP DEFAULT;
ALTER TABLE public.record_categories ALTER COLUMN category_id DROP DEFAULT;
ALTER TABLE public.codex_types ALTER COLUMN type_id DROP DEFAULT;
ALTER TABLE public.codex_categories ALTER COLUMN category_id DROP DEFAULT;
ALTER TABLE public.audit_logs ALTER COLUMN log_id DROP DEFAULT;
DROP SEQUENCE public.users_user_id_seq;
DROP TABLE public.users;
DROP SEQUENCE public.system_settings_id_seq;
DROP TABLE public.system_settings;
DROP SEQUENCE public.regions_id_seq;
DROP TABLE public.regions;
DROP SEQUENCE public.records_record_id_seq;
DROP TABLE public.records;
DROP SEQUENCE public.record_types_type_id_seq;
DROP TABLE public.record_types;
DROP SEQUENCE public.record_categories_category_id_seq;
DROP TABLE public.record_categories;
DROP SEQUENCE public.codex_types_type_id_seq;
DROP TABLE public.codex_types;
DROP SEQUENCE public.codex_categories_category_id_seq;
DROP TABLE public.codex_categories;
DROP SEQUENCE public.audit_logs_log_id_seq;
DROP TABLE public.audit_logs;
DROP TYPE public.user_role;
--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'SUPER_ADMIN',
    'REGIONAL_ADMIN',
    'STAFF'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    log_id integer NOT NULL,
    user_id integer,
    username character varying(100),
    action character varying(50) NOT NULL,
    details text,
    ip_address character varying(50),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: audit_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_log_id_seq OWNED BY public.audit_logs.log_id;


--
-- Name: codex_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codex_categories (
    category_id integer NOT NULL,
    name character varying(100) NOT NULL,
    region character varying(50) DEFAULT 'Global'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: codex_categories_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.codex_categories_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: codex_categories_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.codex_categories_category_id_seq OWNED BY public.codex_categories.category_id;


--
-- Name: codex_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codex_types (
    type_id integer NOT NULL,
    category_id integer,
    type_name character varying(150) NOT NULL,
    retention_period character varying(50),
    region character varying(50) DEFAULT 'Global'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: codex_types_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.codex_types_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: codex_types_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.codex_types_type_id_seq OWNED BY public.codex_types.type_id;


--
-- Name: record_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.record_categories (
    category_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text
);


--
-- Name: record_categories_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.record_categories_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: record_categories_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.record_categories_category_id_seq OWNED BY public.record_categories.category_id;


--
-- Name: record_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.record_types (
    type_id integer NOT NULL,
    category_id integer,
    type_name character varying(255) NOT NULL,
    retention_period character varying(100) DEFAULT '5 Years'::character varying,
    description text
);


--
-- Name: record_types_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.record_types_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: record_types_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.record_types_type_id_seq OWNED BY public.record_types.type_id;


--
-- Name: records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.records (
    record_id integer NOT NULL,
    title character varying(255) NOT NULL,
    region_id integer,
    category character varying(100),
    classification_rule character varying(255),
    file_path character varying(255),
    file_size bigint,
    file_type character varying(50),
    status character varying(50) DEFAULT 'Active'::character varying,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: records_record_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.records_record_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: records_record_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.records_record_id_seq OWNED BY public.records.record_id;


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(10) NOT NULL,
    address character varying(255),
    status character varying(50) DEFAULT 'Active'::character varying
);


--
-- Name: regions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regions_id_seq OWNED BY public.regions.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    system_name character varying(100) DEFAULT 'DOST-RMS'::character varying,
    org_name character varying(100) DEFAULT 'Department of Science and Technology'::character varying,
    logo_url text,
    login_bg_url text,
    primary_color character varying(20) DEFAULT '#4f46e5'::character varying,
    welcome_msg text DEFAULT 'Sign in to access the Enterprise Records Management System.'::text
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    region_id integer,
    office character varying(100),
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    full_name character varying(100),
    email character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    name character varying(255)
);


--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: audit_logs log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN log_id SET DEFAULT nextval('public.audit_logs_log_id_seq'::regclass);


--
-- Name: codex_categories category_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codex_categories ALTER COLUMN category_id SET DEFAULT nextval('public.codex_categories_category_id_seq'::regclass);


--
-- Name: codex_types type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codex_types ALTER COLUMN type_id SET DEFAULT nextval('public.codex_types_type_id_seq'::regclass);


--
-- Name: record_categories category_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_categories ALTER COLUMN category_id SET DEFAULT nextval('public.record_categories_category_id_seq'::regclass);


--
-- Name: record_types type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_types ALTER COLUMN type_id SET DEFAULT nextval('public.record_types_type_id_seq'::regclass);


--
-- Name: records record_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records ALTER COLUMN record_id SET DEFAULT nextval('public.records_record_id_seq'::regclass);


--
-- Name: regions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions ALTER COLUMN id SET DEFAULT nextval('public.regions_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (log_id, user_id, username, action, details, ip_address, user_agent, created_at) FROM stdin;
1	\N	System	SYSTEM_INIT	Audit Trail Module Initialized	127.0.0.1	\N	2026-01-03 15:04:19.64841
2	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:09:37.230426
3	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:15:24.451998
4	1	\N	UPLOAD_RECORD	Uploaded "Rich-Dad-Poor-Dad" to Region ID: 2	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:15:51.4148
5	\N	Super Admin	MANUAL_TEST	Verifying Audit System works	127.0.0.1	\N	2026-01-03 15:18:32.924652
6	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:19:02.356296
7	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:35:38.050531
8	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:36:08.045148
9	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:36:44.56488
10	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:54:12.407155
11	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:57:51.422162
12	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:57:58.529388
13	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-03 15:58:20.739579
14	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:02:57.159839
15	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:04:20.345946
16	\N	Mike	LOGIN_SUCCESS	User Mike logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:04:52.381181
17	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:18:59.380171
18	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:24:34.947545
19	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:24:44.572335
20	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:37:28.320285
21	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:43:59.783333
22	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:53:38.242035
23	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:54:22.696881
24	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 11:59:27.338258
25	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 13:04:32.517861
26	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 13:04:50.527847
27	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 13:09:23.09791
28	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 13:09:40.063351
29	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 13:09:53.987656
30	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 13:15:26.677902
31	\N	Ced	LOGIN_SUCCESS	User Ced logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 13:15:40.855157
32	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 13:16:02.414735
33	\N	admin	LOGIN_SUCCESS	User admin logged in securely.	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	2026-01-05 13:20:18.824132
\.


--
-- Data for Name: codex_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.codex_categories (category_id, name, region, created_at) FROM stdin;
4	Administrative and Management Records	Global	2025-12-26 14:10:57.061903
11	Budget Records	Global	2026-01-03 11:00:03.396859
\.


--
-- Data for Name: codex_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.codex_types (type_id, category_id, type_name, retention_period, region, created_at) FROM stdin;
6	4	Administrative Test 1	5 years	Global	2025-12-29 12:37:40.687896
7	4	Management Test 1	Permanent	Global	2025-12-29 12:37:54.720987
8	11	Budget Record Test 1	7 years	Global	2026-01-03 11:03:44.295922
\.


--
-- Data for Name: record_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.record_categories (category_id, name, description) FROM stdin;
1	Administrative and Management Records	\N
2	Budget Records	\N
3	Financial and Accounting Records	\N
4	Human Resource/Personnel Management Records	\N
5	Information Technology Records	\N
6	Legal Records	\N
7	Procurement and Supply Records	\N
8	Training Records	\N
\.


--
-- Data for Name: record_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.record_types (type_id, category_id, type_name, retention_period, description) FROM stdin;
1	3	Disbursement Vouchers	10 Years	\N
2	3	Audit Reports	Permanent	\N
3	4	201 Files	50 Years	\N
4	1	Project Proposals	3 years after completion	\N
5	1	Acknowledgement Receipts	1 year	\N
6	1	Certifications	1 year	\N
7	1	Gate Passes	6 month	\N
8	2	Annual	3 years	\N
9	1	Official Gazett	5	\N
\.


--
-- Data for Name: records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.records (record_id, title, region_id, category, classification_rule, file_path, file_size, file_type, status, uploaded_at) FROM stdin;
1	Rich-Dad-Poor-Dad	1	Administrative and Management Records	Administrative Test 1	file-1767415969514-836425161.pdf	11863018	application/pdf	Active	2026-01-03 12:52:49.635512
2	Rich-Dad-Poor-Dad	7	Budget Records	Budget Record Test 1	file-1767424263164-842845210.pdf	11863018	application/pdf	Active	2026-01-03 15:11:03.388216
3	Rich-Dad-Poor-Dad	2	Administrative and Management Records	Management Test 1	file-1767424551161-871397025.pdf	11863018	application/pdf	Active	2026-01-03 15:15:51.39668
\.


--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.regions (id, name, code, address, status) FROM stdin;
1	Central Office	CO	\N	Active
2	National Capital Region	NCR	\N	Active
3	Cordillera Administrative Region	CAR	\N	Active
4	Region I - Ilocos	R1	\N	Active
5	Region II - Cagayan Valley	R2	\N	Active
6	Region III - Central Luzon	R3	\N	Active
7	La Union	R1.1	SFC, La Union	Active
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, system_name, org_name, logo_url, login_bg_url, primary_color, welcome_msg) FROM stdin;
1	Record Management System	Department of Science and Technology	/uploads/1766450419483.png	/uploads/1766450419487.png	#4f46e5	Sign in to access the DOSTR1 Record Management System.
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (user_id, username, password, role, region_id, office, status, full_name, email, created_at, name) FROM stdin;
1	admin	password123	SUPER_ADMIN	1	Central Office	ACTIVE	System Administrator	admin@dost.gov.ph	2026-01-03 12:37:26.178718	admin
2	Ced	$2b$10$lsD70XhXLG1hdS/aUXuWFe0.nUEcNrhlW.sEZHZBh8nfZGltnzLWy	REGIONAL_ADMIN	7	Admin	ACTIVE	\N	\N	2026-01-03 14:06:59.245457	Ced
3	Mike	$2b$10$UszF5idGuedq7H8IIapL9OHcgSgYnCq.HZj.n5ZS3ydh8Kqik0p5e	STAFF	7	Staff	ACTIVE	\N	\N	2026-01-03 14:08:28.031321	Mike
\.


--
-- Name: audit_logs_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_log_id_seq', 33, true);


--
-- Name: codex_categories_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.codex_categories_category_id_seq', 14, true);


--
-- Name: codex_types_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.codex_types_type_id_seq', 8, true);


--
-- Name: record_categories_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.record_categories_category_id_seq', 24, true);


--
-- Name: record_types_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.record_types_type_id_seq', 9, true);


--
-- Name: records_record_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.records_record_id_seq', 3, true);


--
-- Name: regions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.regions_id_seq', 7, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 1, false);


--
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_user_id_seq', 3, true);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id);


--
-- Name: codex_categories codex_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codex_categories
    ADD CONSTRAINT codex_categories_name_key UNIQUE (name);


--
-- Name: codex_categories codex_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codex_categories
    ADD CONSTRAINT codex_categories_pkey PRIMARY KEY (category_id);


--
-- Name: codex_types codex_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codex_types
    ADD CONSTRAINT codex_types_pkey PRIMARY KEY (type_id);


--
-- Name: record_categories record_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_categories
    ADD CONSTRAINT record_categories_name_key UNIQUE (name);


--
-- Name: record_categories record_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_categories
    ADD CONSTRAINT record_categories_pkey PRIMARY KEY (category_id);


--
-- Name: record_types record_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_types
    ADD CONSTRAINT record_types_pkey PRIMARY KEY (type_id);


--
-- Name: records records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_pkey PRIMARY KEY (record_id);


--
-- Name: regions regions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_code_key UNIQUE (code);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_date ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user ON public.audit_logs USING btree (username);


--
-- Name: codex_types codex_types_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codex_types
    ADD CONSTRAINT codex_types_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.codex_categories(category_id) ON DELETE CASCADE;


--
-- Name: record_types record_types_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_types
    ADD CONSTRAINT record_types_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.record_categories(category_id) ON DELETE CASCADE;


--
-- Name: records records_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: users users_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- PostgreSQL database dump complete
--

\unrestrict biueApsg8OAh1LGa4NDhGNt3KpQD5glGsbimbokPapbgW30X6KH1dSXo8bja4uN

