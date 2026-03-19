'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import AdminGuard from '../../components/AdminGuard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Exam { id: string; name: string; display_name: string; icon: string; is_active: boolean; created_at: string; }
interface ContestSection { id: string; contest_id: string; section_name: string; section_order: number; time_limit_minutes: number | null; }
interface Contest { id: string; exam_id: string; contest_number: number; title: string; contest_type: string; description: string; start_time: string; end_time: string; duration_minutes: number; total_questions: number; total_marks: number; is_active: boolean; created_at: string; exams?: { name: string; icon: string }; contest_sections?: ContestSection[]; }
interface QuestionOption { id: string; option_label: string; option_text: string; option_image_url: string; is_correct: boolean; option_order: number; }
interface QuestionSolution { solution_text: string; solution_image_url: string; solution_video_url: string; }
interface Question { id: string; exam_id: string; subject: string; chapter: string; topic: string; contest_id: string; contest_section_id: string; question_number: number; question_text: string; question_image_url: string; question_type: string; difficulty: string; positive_marks: number; negative_marks: number; partial_marks: number; numerical_answer: number; numerical_tolerance: number; source: string; tags: string[]; visibility: string; created_at: string; exams?: { name: string; display_name: string; icon: string }; contests?: { title: string; contest_number: number }; contest_sections?: { section_name: string }; question_options?: QuestionOption[]; question_solutions?: QuestionSolution[]; }

type OptionState = { id: string | null; option_label: string; option_text: string; option_image_url: string; is_correct: boolean; option_order: number; imagePreview: string; };
type SectionState = { id?: string; section_name: string; section_order: number; time_limit_minutes: string };

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'exams' | 'contests' | 'questions' | 'study'>('exams');

  // Exams
  const [exams, setExams] = useState<Exam[]>([]);
  const [examForm, setExamForm] = useState({ name: '', display_name: '', icon: '📚', is_active: true });
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  // Contests
  const [contests, setContests] = useState<Contest[]>([]);
  const [contestForm, setContestForm] = useState({ exam_id: '', contest_number: '', title: '', description: '', contest_type: 'standard', start_time: '', end_time: '', duration_minutes: '', total_questions: 0, total_marks: 0, is_active: true });
  const [sections, setSections] = useState<SectionState[]>([{ section_name: '', section_order: 1, time_limit_minutes: '' }]);
  const [editingContestId, setEditingContestId] = useState<string | null>(null);

  // Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterExam, setFilterExam] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [contestSections, setContestSections] = useState<ContestSection[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'exam'|'contest'|'question'; id: string; name: string} | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  const [questionImagePreview, setQuestionImagePreview] = useState('');
  const [solutionImagePreview, setSolutionImagePreview] = useState('');
  const [solutionVideoName, setSolutionVideoName] = useState('');

  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const [chapterSuggestions, setChapterSuggestions] = useState<string[]>([]);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const router = useRouter();

  const [formData, setFormData] = useState({ exam_id: '', subject: '', chapter: '', topic: '', contest_id: '', contest_section_id: '', question_number: '', question_text: '', question_image_url: '', question_type: 'mcq', difficulty: 'medium', positive_marks: 4, negative_marks: 1, partial_marks: 0, numerical_answer: '', numerical_tolerance: 0.01, source: '', tags: '', visibility: 'practice' });

  const [options, setOptions] = useState<OptionState[]>([
    { id: null, option_label: 'A', option_text: '', option_image_url: '', is_correct: false, option_order: 0, imagePreview: '' },
    { id: null, option_label: 'B', option_text: '', option_image_url: '', is_correct: false, option_order: 1, imagePreview: '' },
    { id: null, option_label: 'C', option_text: '', option_image_url: '', is_correct: false, option_order: 2, imagePreview: '' },
    { id: null, option_label: 'D', option_text: '', option_image_url: '', is_correct: false, option_order: 3, imagePreview: '' },
  ]);

  const [solution, setSolution] = useState({ solution_text: '', solution_image_url: '', solution_video_url: '' });

  // ── Study Room state ──────────────────────────────────────────
  const [studyTopics,     setStudyTopics]     = useState<any[]>([]);
  const [studyQs,         setStudyQs]         = useState<any[]>([]);
  const [studyLoading,    setStudyLoading]     = useState(false);
  const [studyEditId,     setStudyEditId]      = useState<string|null>(null);
  const [studySearch,     setStudySearch]      = useState('');
  const [studyFilterSec,  setStudyFilterSec]   = useState('all');
  const [studyView,       setStudyView]        = useState<'list'|'form'>('list');
  const [studyForm, setStudyForm] = useState({
    subject_section:'qa', module:'', topic:'', description:'',
    difficulty:'moderate', estimated_mins:20,
    pdf_url:'', video_url:'', video_type:'youtube', is_published:false,
  });
  const [studyPdfFile,    setStudyPdfFile]     = useState<string|null>(null);
  const [studyVideoFile,  setStudyVideoFile]   = useState<string|null>(null);
  const [studyVideoName,  setStudyVideoName]   = useState('');
  const [studyQList, setStudyQList] = useState<any[]>([
    {uid:Date.now(),type:'mcq',text:'',image:null,options:[{id:'A',t:''},{id:'B',t:''},{id:'C',t:''},{id:'D',t:''}],correct:'A',difficulty:'moderate',sol_text:'',sol_image:null}
  ]);

  // ── Study Room handlers ────────────────────────────────────────
  const SD_MODULES: Record<string,string[]> = {
    qa:   ['Arithmetic','Algebra','Geometry','Number Systems','Modern Math'],
    dilr: ['Logical Reasoning','Data Interpretation','Puzzles'],
    varc: ['Verbal Ability','Reading Comprehension'],
  };
  const SD_TOPICS: Record<string,Record<string,string[]>> = {
    qa: {Arithmetic:['Percentages','Profit & Loss','SI & CI','Averages','Time & Work'],Algebra:['Linear Equations','Quadratic Equations','Logarithms','Functions','Progressions'],Geometry:['Triangles','Circles','Polygons','Coordinate Geometry','Mensuration'],'Number Systems':['Remainders','Factors','LCM & HCF'],'Modern Math':['P&C','Probability','Set Theory']},
    dilr: {'Logical Reasoning':['Blood Relations','Seating Arrangement','Syllogisms','Clocks & Calendars'],'Data Interpretation':['Tables','Bar Charts','Pie Charts','Caselets'],Puzzles:['Matrix Match','Grid Puzzles','Ranking']},
    varc: {'Verbal Ability':['Para Jumbles','Odd One Out','Para Summary','Sentence Completion'],'Reading Comprehension':['Philosophy','Social Science','Business & Economics','Science & Tech']},
  };

  const blankStudyQ = () => ({uid:Date.now()+Math.random(),type:'mcq',text:'',image:null,options:[{id:'A',t:''},{id:'B',t:''},{id:'C',t:''},{id:'D',t:''}],correct:'A',difficulty:'moderate',sol_text:'',sol_image:null});

  async function fetchStudyTopics() {
    setStudyLoading(true);
    const {data} = await supabase.from('study_topics').select('*').order('subject_section').order('module').order('created_at',{ascending:false});
    const withCounts = await Promise.all((data??[]).map(async (t:any)=>{
      const {count} = await supabase.from('study_questions').select('id',{count:'exact',head:true}).eq('topic_id',t.id);
      return {...t,question_count:count??0};
    }));
    setStudyTopics(withCounts);
    setStudyLoading(false);
  }

  async function uploadStudyFile(base64:string, name:string): Promise<string> {
    const [meta,b64] = base64.split(',');
    const mime = meta.match(/data:([^;]+);/)?.[1]??'application/octet-stream';
    const blob = await fetch(`${meta},${b64}`).then(r=>r.blob());
    const {data,error} = await supabase.storage.from('catImage').upload(`${Date.now()}-${name}`, blob, {contentType:mime});
    if (error) throw error;
    return supabase.storage.from('catImage').getPublicUrl(data.path).data.publicUrl;
  }

  async function handleStudySave() {
    if (!studyForm.module||!studyForm.topic) { setError('Fill Module and Topic'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      let pdfUrl = studyForm.pdf_url;
      if (studyPdfFile) pdfUrl = await uploadStudyFile(studyPdfFile, `study-${studyForm.topic}.pdf`);
      let videoUrl = studyForm.video_url;
      if (studyVideoFile) videoUrl = await uploadStudyFile(studyVideoFile, studyVideoName||'video.mp4');

      const payload = {...studyForm, pdf_url:pdfUrl||null, video_url:videoUrl||null, video_type:studyVideoFile?'upload':studyForm.video_type};
      let topicId:string;
      if (studyEditId) {
        const {error} = await supabase.from('study_topics').update(payload).eq('id',studyEditId);
        if (error) throw error;
        topicId = studyEditId;
        await supabase.from('study_questions').delete().eq('topic_id',topicId);
      } else {
        const {data,error} = await supabase.from('study_topics').insert([payload]).select().single();
        if (error) throw error;
        topicId = data.id;
      }
      const toInsert = await Promise.all(studyQList.map(async (q:any,i:number)=>{
        const qImg = q.image?.startsWith('data:') ? await uploadStudyFile(q.image,`q${i}.png`) : q.image??null;
        const sImg = q.sol_image?.startsWith('data:') ? await uploadStudyFile(q.sol_image,`sol${i}.png`) : q.sol_image??null;
        return {topic_id:topicId,question_text:q.text,question_image_url:qImg,question_type:q.type,options:q.type==='mcq'?q.options:null,correct_option:q.correct,difficulty:q.difficulty,solution_text:q.sol_text||null,solution_image_url:sImg,order_index:i};
      }));
      const {error:qErr} = await supabase.from('study_questions').insert(toInsert);
      if (qErr) throw qErr;
      setSuccess(studyEditId?'Topic updated!':'Topic published!');
      resetStudyForm(); await fetchStudyTopics(); setStudyView('list');
    } catch(e:any){ setError(e.message??'Save failed'); }
    finally { setLoading(false); }
  }

  async function handleStudyDelete(id:string, name:string) {
    setDeleteConfirm({type:'exam',id,name}); // reuse modal — we'll intercept via custom handler
  }

  async function doStudyDelete(id:string) {
    setLoading(true);
    await supabase.from('study_questions').delete().eq('topic_id',id);
    await supabase.from('study_topics').delete().eq('id',id);
    setSuccess('Topic deleted'); await fetchStudyTopics();
    setLoading(false); setDeleteConfirm(null);
  }

  async function toggleStudyPublish(t:any) {
    await supabase.from('study_topics').update({is_published:!t.is_published}).eq('id',t.id);
    await fetchStudyTopics();
  }

  async function openStudyEdit(t:any) {
    setStudyForm({subject_section:t.subject_section,module:t.module,topic:t.topic,description:t.description??'',difficulty:t.difficulty,estimated_mins:t.estimated_mins,pdf_url:t.pdf_url??'',video_url:t.video_url??'',video_type:t.video_type??'youtube',is_published:t.is_published});
    setStudyPdfFile(null); setStudyVideoFile(null); setStudyVideoName('');
    const {data:qs} = await supabase.from('study_questions').select('*').eq('topic_id',t.id).order('order_index',{ascending:true});
    const fqs = (qs??[]).map((q:any,i:number)=>({uid:i+Date.now(),type:q.question_type,text:q.question_text,image:q.question_image_url??null,options:q.options??[{id:'A',t:''},{id:'B',t:''},{id:'C',t:''},{id:'D',t:''}],correct:q.correct_option,difficulty:q.difficulty,sol_text:q.solution_text??'',sol_image:q.solution_image_url??null}));
    setStudyQList(fqs.length>0?fqs:[blankStudyQ()]);
    setStudyEditId(t.id); setStudyView('form');
  }

  function resetStudyForm() {
    setStudyForm({subject_section:'qa',module:'',topic:'',description:'',difficulty:'moderate',estimated_mins:20,pdf_url:'',video_url:'',video_type:'youtube',is_published:false});
    setStudyPdfFile(null); setStudyVideoFile(null); setStudyVideoName('');
    setStudyQList([blankStudyQ()]); setStudyEditId(null);
  }

  const goToStudyAdmin = () => router.push('/admin/study');
  const handleLogout = async () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('adminUser');
    await supabase.auth.signOut();
    router.push('/admin');
  };

  useEffect(() => {
    if (activeTab === 'exams') fetchExams();
    else if (activeTab === 'contests') { fetchExams(); fetchContests(); }
    else if (activeTab === 'questions') { fetchExams(); fetchContests(); fetchQuestions(); fetchSuggestions(); }
    else if (activeTab === 'study') fetchStudyTopics();
  }, [activeTab]);

  useEffect(() => {
    let filtered = questions;
    if (searchQuery) filtered = filtered.filter(q => q.question_text?.toLowerCase().includes(searchQuery.toLowerCase()) || q.subject?.toLowerCase().includes(searchQuery.toLowerCase()) || q.chapter?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filterExam) filtered = filtered.filter(q => q.exam_id === filterExam);
    if (filterSubject) filtered = filtered.filter(q => q.subject === filterSubject);
    setFilteredQuestions(filtered);
  }, [searchQuery, filterExam, filterSubject, questions]);

  const uniqueSubjects = [...new Set(questions.map(q => q.subject).filter(Boolean))];

  const convertToIST = (utcDate: string) => {
    if (!utcDate) return '';
    const date = new Date(utcDate);
    const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
    return istDate.toISOString().slice(0, 16);
  };

  const convertToUTC = (istDate: string) => {
    if (!istDate) return '';
    const date = new Date(istDate);
    return new Date(date.getTime() - 5.5 * 60 * 60 * 1000).toISOString();
  };

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  const fetchSuggestions = async () => {
    const { data } = await supabase.from('questions').select('subject, chapter, topic');
    if (data) {
      setSubjectSuggestions([...new Set(data.map((q: any) => q.subject).filter(Boolean))]as string[]);
      setChapterSuggestions([...new Set(data.map((q: any) => q.chapter).filter(Boolean))]as string[]);
      setTopicSuggestions([...new Set(data.map((q: any) => q.topic).filter(Boolean))]as string[]);
    }
  };

  const fetchExams = async () => {
    setError('');
    const { data, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setExams(data || []);
  };

  const fetchContests = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('contests').select('*, exams(name, icon), contest_sections(*)').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setContests(data || []);
    setLoading(false);
  };

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('questions').select('*, exams(name, display_name, icon), contests(title, contest_number), contest_sections(section_name), question_options(*), question_solutions(*)').order('created_at', { ascending: false });
    if (error) { setError('Failed to load: ' + error.message); }
    else {
      setQuestions(data || []);
      setFilteredQuestions(data || []);
      if (data?.length) { setSuccessMessage(`✅ ${data.length} questions loaded!`); setTimeout(() => setSuccessMessage(''), 2000); }
    }
    setLoading(false);
  };

  const fetchContestSections = async (contestId: string) => {
    if (!contestId) { setContestSections([]); return; }
    const { data } = await supabase.from('contest_sections').select('*').eq('contest_id', contestId).order('section_order');
    if (data) setContestSections(data);
  };

  // ── Exam CRUD ───────────────────────────────────────────────────────────────
  const handleExamSubmit = async (keepOpen = false) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      if (editingExamId) {
        const { error } = await supabase.from('exams').update(examForm).eq('id', editingExamId);
        if (error) throw error;
        setSuccess('Exam updated!'); setEditingExamId(null);
      } else {
        const { error } = await supabase.from('exams').insert(examForm);
        if (error) throw error;
        setSuccess(keepOpen ? 'Exam added! Add another.' : 'Exam added!');
      }
      setExamForm(keepOpen ? { ...examForm, name: '', display_name: '' } : { name: '', display_name: '', icon: '📚', is_active: true });
      await fetchExams();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleExamDelete = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) setError(error.message); else { setSuccess('Exam deleted!'); await fetchExams(); }
    setDeleteConfirm(null); setLoading(false);
  };

  // ── Contest CRUD ────────────────────────────────────────────────────────────
  const handleSectionChange = (index: number, field: string, value: string) => {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addSection = () => setSections(prev => [...prev, { section_name: '', section_order: prev.length + 1, time_limit_minutes: '' }]);
  const removeSection = (index: number) => setSections(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, section_order: i + 1 })));

  const handleContestSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    let currentContestId = editingContestId;
    let savedSections: ContestSection[] = [];
    try {
      if (!contestForm.exam_id || !contestForm.title) throw new Error('Please fill required fields');
      const payload = { exam_id: contestForm.exam_id, contest_number: parseInt(contestForm.contest_number) || 0, title: contestForm.title, contest_type: contestForm.contest_type, description: contestForm.description, start_time: convertToUTC(contestForm.start_time), end_time: convertToUTC(contestForm.end_time), duration_minutes: parseInt(contestForm.duration_minutes) || 0, total_questions: parseInt(String(contestForm.total_questions)) || 0, total_marks: parseInt(String(contestForm.total_marks)) || 0, is_active: contestForm.is_active };

      if (editingContestId) {
        const { error } = await supabase.from('contests').update(payload).eq('id', editingContestId);
        if (error) throw error;
        const toUpsert = sections.map(s => ({ ...(s.id ? { id: s.id } : {}), contest_id: editingContestId, section_name: s.section_name, section_order: parseInt(String(s.section_order)), time_limit_minutes: s.time_limit_minutes ? parseInt(s.time_limit_minutes) : null }));
        const { data, error: sErr } = await supabase.from('contest_sections').upsert(toUpsert, { onConflict: 'id' }).select();
        if (sErr) throw sErr;
        savedSections = data || [];
        setSuccess('Contest updated!');
      } else {
        const { data: cd, error: cErr } = await supabase.from('contests').insert(payload).select().single();
        if (cErr) throw cErr;
        currentContestId = cd.id;
        const toInsert = sections.map(s => ({ contest_id: currentContestId!, section_name: s.section_name, section_order: parseInt(String(s.section_order)), time_limit_minutes: s.time_limit_minutes ? parseInt(s.time_limit_minutes) : null }));
        const { data, error: sErr } = await supabase.from('contest_sections').insert(toInsert).select();
        if (sErr) throw sErr;
        savedSections = data || [];
        setSuccess('Contest created!');
      }

      if (savedSections.length > 0) setFormData(prev => ({ ...prev, exam_id: contestForm.exam_id, contest_id: currentContestId!, contest_section_id: savedSections[0].id }));
      resetContestForm();
      fetchContests();
      if (currentContestId) fetchContestSections(currentContestId);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleContestEdit = async (contest: Contest) => {
    setEditingContestId(contest.id);
    setContestForm({ exam_id: contest.exam_id, contest_number: String(contest.contest_number), title: contest.title, contest_type: contest.contest_type || 'standard', description: contest.description || '', start_time: convertToIST(contest.start_time), end_time: convertToIST(contest.end_time), duration_minutes: String(contest.duration_minutes), total_questions: contest.total_questions, total_marks: contest.total_marks, is_active: contest.is_active });
    const { data } = await supabase.from('contest_sections').select('*').eq('contest_id', contest.id).order('section_order');
    if (data) setSections(data.map((s: ContestSection) => ({ id: s.id, section_name: s.section_name, section_order: s.section_order, time_limit_minutes: s.time_limit_minutes ? String(s.time_limit_minutes) : '' })));
    setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContestDelete = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('contests').delete().eq('id', id);
    if (error) setError(error.message); else { setSuccess('Contest deleted!'); fetchContests(); }
    setDeleteConfirm(null); setLoading(false);
  };

  const resetContestForm = () => {
    setContestForm({ exam_id: '', contest_number: '', title: '', description: '', contest_type: 'standard', start_time: '', end_time: '', duration_minutes: '', total_questions: 0, total_marks: 0, is_active: true });
    setSections([{ section_name: '', section_order: 1, time_limit_minutes: '' }]);
    setEditingContestId(null);
  };

  // ── Question CRUD ───────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'contest_id' && value) fetchContestSections(value);
  };

  const handleOptionChange = (index: number, field: string, value: string | boolean) => {
    setOptions(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  const addOption = () => {
    const label = String.fromCharCode(65 + options.length);
    setOptions(prev => [...prev, { id: null, option_label: label, option_text: '', option_image_url: '', is_correct: false, option_order: prev.length, imagePreview: '' }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) { setError('At least 2 options required.'); return; }
    setOptions(prev => prev.filter((_, i) => i !== index).map((o, i) => ({ ...o, option_order: i })));
  };

  const uploadToStorage = async (file: File, bucket: string, folder = '') => {
    const ext = file.name.split('.').pop();
    const fileName = `${folder ? folder + '/' : ''}${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicUrl;
  };

  const handleQuestionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingFiles(prev => ({ ...prev, questionImage: true }));
    try {
      const url = await uploadToStorage(file, 'question-images', 'questions');
      setFormData(prev => ({ ...prev, question_image_url: url }));
      setQuestionImagePreview(URL.createObjectURL(file));
      setSuccessMessage('✅ Image uploaded!'); setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err: any) { setError('❌ Upload failed: ' + err.message); }
    finally { setUploadingFiles(prev => ({ ...prev, questionImage: false })); }
  };

  const handleSolutionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingFiles(prev => ({ ...prev, solutionImage: true }));
    try {
      const url = await uploadToStorage(file, 'question-images', 'solutions');
      setSolution(prev => ({ ...prev, solution_image_url: url }));
      setSolutionImagePreview(URL.createObjectURL(file));
      setSuccessMessage('✅ Solution image uploaded!'); setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err: any) { setError('❌ ' + err.message); }
    finally { setUploadingFiles(prev => ({ ...prev, solutionImage: false })); }
  };

  const handleSolutionVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 100 * 1024 * 1024) { setError('Video file must be under 100MB.'); return; }
    setUploadingFiles(prev => ({ ...prev, solutionVideo: true }));
    try {
      const url = await uploadToStorage(file, 'solution-videos', 'videos');
      setSolution(prev => ({ ...prev, solution_video_url: url }));
      setSolutionVideoName(file.name);
      setSuccessMessage('✅ Video uploaded!'); setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err: any) { setError('❌ ' + err.message); }
    finally { setUploadingFiles(prev => ({ ...prev, solutionVideo: false })); }
  };

  const handleOptionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingFiles(prev => ({ ...prev, [`option_${index}`]: true }));
    try {
      const url = await uploadToStorage(file, 'question-images', 'options');
      setOptions(prev => prev.map((o, i) => i === index ? { ...o, option_image_url: url, imagePreview: URL.createObjectURL(file) } : o));
      setSuccessMessage('✅ Option image uploaded!'); setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err: any) { setError('❌ ' + err.message); }
    finally { setUploadingFiles(prev => ({ ...prev, [`option_${index}`]: false })); }
  };

  const handleQuestionSubmit = async (action = 'save') => {
    if (!formData.exam_id || !formData.subject || !formData.question_text) { setError('❌ Exam, Subject, and Question Text are required'); return; }
    setLoading(true); setError('');
    try {
      const tagsArray = formData.tags ? formData.tags.split(',').map(t => t.trim()) : [];
      const qData = { ...formData, tags: tagsArray, contest_id: formData.contest_id || null, contest_section_id: formData.contest_section_id || null, question_number: formData.question_number ? parseInt(formData.question_number) : null, numerical_answer: formData.numerical_answer ? parseFloat(formData.numerical_answer) : null, numerical_tolerance: parseFloat(String(formData.numerical_tolerance)) };

      let questionId: string;

      if (editingQuestionId) {
        const { error } = await supabase.from('questions').update(qData).eq('id', editingQuestionId);
        if (error) throw error;
        questionId = editingQuestionId;
        await supabase.from('question_options').delete().eq('question_id', editingQuestionId);
        await new Promise(r => setTimeout(r, 100));
        if (solution.solution_text || solution.solution_image_url || solution.solution_video_url) await supabase.from('question_solutions').delete().eq('question_id', editingQuestionId);
        setSuccessMessage('✅ Question updated!');
      } else {
        const { data, error } = await supabase.from('questions').insert(qData).select().single();
        if (error) throw error;
        questionId = data.id;
        setSuccessMessage('✅ Question added!');
      }

      if (formData.question_type === 'mcq' || formData.question_type === 'multiple_correct') {
        const optionsData = options.map((opt, i) => ({ question_id: questionId, option_label: String.fromCharCode(65 + i), option_text: opt.option_text || '', option_image_url: opt.option_image_url || null, is_correct: opt.is_correct || false, option_order: i }));
        const { error } = await supabase.from('question_options').insert(optionsData);
        if (error) throw error;
      }

      if (solution.solution_text || solution.solution_image_url || solution.solution_video_url) {
        const { error } = await supabase.from('question_solutions').insert({ question_id: questionId, solution_text: solution.solution_text || null, solution_image_url: solution.solution_image_url || null, solution_video_url: solution.solution_video_url || null });
        if (error) throw error;
      }

      await fetchQuestions(); await fetchSuggestions();
      setTimeout(() => resetQuestionForm(), action === 'save' ? 2000 : 1500);
    } catch (err: any) { setError('❌ ' + err.message); }
    finally { setLoading(false); }
  };

  const handleQuestionEdit = async (question: Question) => {
    if (editingQuestionId === question.id) return;
    setEditingQuestionId(question.id); setSuccessMessage(''); setError(''); setCurrentStep(1);
    setFormData({ exam_id: question.exam_id || '', subject: question.subject || '', chapter: question.chapter || '', topic: question.topic || '', contest_id: question.contest_id || '', contest_section_id: question.contest_section_id || '', question_number: String(question.question_number || ''), question_text: question.question_text || '', question_image_url: question.question_image_url || '', question_type: question.question_type || 'mcq', difficulty: question.difficulty || 'medium', positive_marks: question.positive_marks || 4, negative_marks: question.negative_marks || 1, partial_marks: question.partial_marks || 0, numerical_answer: String(question.numerical_answer || ''), numerical_tolerance: question.numerical_tolerance || 0.01, source: question.source || '', tags: Array.isArray(question.tags) ? question.tags.join(', ') : '', visibility: question.visibility || 'practice' });

    const dbOptions = question.question_options || [];
    if (dbOptions.length > 0) {
      setOptions(dbOptions.sort((a, b) => a.option_order - b.option_order).map((opt, i) => ({ id: null, option_label: String.fromCharCode(65 + i), option_text: opt.option_text || '', option_image_url: opt.option_image_url || '', is_correct: opt.is_correct || false, option_order: i, imagePreview: opt.option_image_url || '' })));
    } else {
      setOptions([{ id: null, option_label: 'A', option_text: '', option_image_url: '', is_correct: false, option_order: 0, imagePreview: '' }, { id: null, option_label: 'B', option_text: '', option_image_url: '', is_correct: false, option_order: 1, imagePreview: '' }, { id: null, option_label: 'C', option_text: '', option_image_url: '', is_correct: false, option_order: 2, imagePreview: '' }, { id: null, option_label: 'D', option_text: '', option_image_url: '', is_correct: false, option_order: 3, imagePreview: '' }]);
    }

    if (question.question_solutions?.length) {
      const sol = question.question_solutions[0];
      setSolution({ solution_text: sol.solution_text || '', solution_image_url: sol.solution_image_url || '', solution_video_url: sol.solution_video_url || '' });
      if (sol.solution_image_url) setSolutionImagePreview(sol.solution_image_url);
      if (sol.solution_video_url) setSolutionVideoName('Video uploaded');
    } else { setSolution({ solution_text: '', solution_image_url: '', solution_video_url: '' }); }

    if (question.question_image_url) setQuestionImagePreview(question.question_image_url);
    if (question.contest_id) await fetchContestSections(question.contest_id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuestionDelete = async (id: string) => {
    setLoading(true);
    await supabase.from('question_options').delete().eq('question_id', id);
    await supabase.from('question_solutions').delete().eq('question_id', id);
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) setError('❌ ' + error.message); else { setSuccessMessage('✅ Question deleted!'); fetchQuestions(); }
    setDeleteConfirm(null); setLoading(false);
  };

  const resetQuestionForm = () => {
    setFormData({ exam_id: '', subject: '', chapter: '', topic: '', contest_id: '', contest_section_id: '', question_number: '', question_text: '', question_image_url: '', question_type: 'mcq', difficulty: 'medium', positive_marks: 4, negative_marks: 1, partial_marks: 0, numerical_answer: '', numerical_tolerance: 0.01, source: '', tags: '', visibility: 'practice' });
    setOptions([{ id: null, option_label: 'A', option_text: '', option_image_url: '', is_correct: false, option_order: 0, imagePreview: '' }, { id: null, option_label: 'B', option_text: '', option_image_url: '', is_correct: false, option_order: 1, imagePreview: '' }, { id: null, option_label: 'C', option_text: '', option_image_url: '', is_correct: false, option_order: 2, imagePreview: '' }, { id: null, option_label: 'D', option_text: '', option_image_url: '', is_correct: false, option_order: 3, imagePreview: '' }]);
    setSolution({ solution_text: '', solution_image_url: '', solution_video_url: '' });
    setQuestionImagePreview(''); setSolutionImagePreview(''); setSolutionVideoName('');
    setEditingQuestionId(null); setSuccessMessage(''); setError(''); setCurrentStep(1);
  };

  const toggleStep = (step: number) => setCurrentStep(currentStep === step ? 0 : step);

  // ─── Shared UI helpers ───────────────────────────────────────────────────────
  const Input = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-gray-300 mb-2 font-medium text-sm">{label}</label>
      <input {...props} className={`w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-600 rounded text-white focus:outline-none focus:border-[#5fa8c8] transition ${props.className || ''}`} />
    </div>
  );

  const Select = ({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <div>
      <label className="block text-gray-300 mb-2 font-medium text-sm">{label}</label>
      <select {...props} className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-600 rounded text-white focus:outline-none focus:border-[#5fa8c8]">{children}</select>
    </div>
  );

  const StepHeader = ({ step, currentStep: cs, setCurrentStep: scs, labels }: { step: number; currentStep: number; setCurrentStep: (n: number) => void; labels: string[] }) => (
    <button onClick={() => scs(cs === step ? 0 : step)} className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-white/3 transition">
      <div className="flex items-center gap-3">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${cs === step ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-500'}`}>{step}</span>
        <span className={`text-sm font-bold transition-all ${cs === step ? 'text-white' : 'text-gray-500'}`}>{labels[step-1]}</span>
      </div>
      <span className={`text-gray-600 transition-transform text-xs ${cs === step ? 'rotate-180' : ''}`}>▼</span>
    </button>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#060608] text-white">
        {/* Bg */}
        <div className="fixed inset-0 z-0 opacity-[0.02]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',backgroundSize:'40px 40px'}}/>
        <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_60%_30%_at_50%_0%,rgba(249,115,22,0.07),transparent)]"/>

        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-[#060608]/90 backdrop-blur-xl border-b border-white/8 px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-[0_0_12px_rgba(249,115,22,0.4)]">
              <span className="text-white font-black text-xs">C</span>
            </div>
            <div>
              <span className="text-white font-black text-sm tracking-tight">CAT<span className="text-orange-500">OMAINA</span></span>
              <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest ml-2">Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {successMessage && <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">{successMessage}</span>}
            {success && <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">{success}</span>}
            {error && <span className="text-red-400 text-xs font-bold bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl max-w-xs truncate">{error}</span>}
            <a href="/uploadQuestion"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition text-xs font-bold">
              📚 CAT Mock Studio
            </a>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition text-xs font-bold">
              Logout
            </button>
          </div>
        </header>

        <div className="relative z-10 max-w-400 mx-auto px-6 py-6">

          {/* Tabs */}
          <div className="flex items-center gap-1.5 mb-6 bg-white/3 border border-white/8 rounded-2xl p-1.5 w-fit">
            {(['exams','contests','questions','study'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab===tab?'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]':'text-gray-500 hover:text-gray-300'}`}>
                {tab==='exams'?'📚 Exams':tab==='contests'?'🏆 Contests':tab==='questions'?'❓ Questions':'📖 Study Room'}
              </button>
            ))}
          </div>

          {/* ══ EXAMS TAB ══ */}
          {activeTab==='exams' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Form */}
              <div className="xl:col-span-2 bg-white/3 border border-white/8 rounded-3xl p-6">
                <h2 className="text-white font-black text-lg mb-5">{editingExamId?'Edit Exam':'Add New Exam'}</h2>
                <div className="space-y-4">
                  <Field label="Short Code *"><input type="text" value={examForm.name} onChange={e=>setExamForm({...examForm,name:e.target.value})} className={inp} placeholder="CAT, XAT, SNAP"/></Field>
                  <Field label="Display Name *"><input type="text" value={examForm.display_name} onChange={e=>setExamForm({...examForm,display_name:e.target.value})} className={inp} placeholder="Common Admission Test"/></Field>
                  <Field label="Icon"><input type="text" value={examForm.icon} onChange={e=>setExamForm({...examForm,icon:e.target.value})} className={`${inp} w-20`} maxLength={2}/></Field>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={examForm.is_active} onChange={e=>setExamForm({...examForm,is_active:e.target.checked})} className="w-4 h-4 accent-orange-500"/>
                    <span className="text-gray-400 text-sm">Active</span>
                  </label>
                  <div className="flex gap-3 pt-2">
                    <Btn onClick={()=>handleExamSubmit(false)} loading={loading} primary>{editingExamId?'Update':'Add Exam'}</Btn>
                    {!editingExamId&&<Btn onClick={()=>handleExamSubmit(true)} loading={loading}>Save & Add Another</Btn>}
                    {editingExamId&&<Btn onClick={()=>{setEditingExamId(null);setExamForm({name:'',display_name:'',icon:'📚',is_active:true});}}>Cancel</Btn>}
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="bg-white/3 border border-white/8 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-black text-base">All Exams</h2>
                  <span className="bg-orange-500/20 text-orange-400 font-black text-xs px-2.5 py-1 rounded-full border border-orange-500/30">{exams.length}</span>
                </div>
                {exams.length===0 ? <p className="text-gray-600 text-sm text-center py-10">No exams yet.</p> : (
                  <div className="space-y-2.5 max-h-130 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'#333 transparent'}}>
                    {exams.map(exam=>(
                      <div key={exam.id} className="bg-white/3 border border-white/8 rounded-2xl p-4 hover:border-orange-500/20 transition">
                        <div className="flex items-center gap-2 mb-1"><span className="text-xl">{exam.icon}</span><span className="text-white font-black text-sm">{exam.name}</span><span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-lg ${exam.is_active?'bg-emerald-500/15 text-emerald-400':'bg-gray-700 text-gray-500'}`}>{exam.is_active?'Active':'Off'}</span></div>
                        <p className="text-gray-600 text-xs mb-3">{exam.display_name}</p>
                        <div className="flex gap-2">
                          <button onClick={()=>{setExamForm({name:exam.name,display_name:exam.display_name,icon:exam.icon||'📚',is_active:exam.is_active});setEditingExamId(exam.id);}} className="flex-1 py-1.5 rounded-xl bg-orange-500/15 text-orange-400 text-xs font-bold hover:bg-orange-500/25 transition">Edit</button>
                          <button onClick={()=>handleExamDelete(exam.id)} className="flex-1 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ CONTESTS TAB ══ */}
          {activeTab==='contests' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2 bg-white/3 border border-white/8 rounded-3xl p-6">
                <h2 className="text-white font-black text-lg mb-5">{editingContestId?'Edit Contest':'Create Contest'}</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Exam *">
                      <select value={contestForm.exam_id} onChange={e=>setContestForm({...contestForm,exam_id:e.target.value})} className={sel}>
                        <option value="">Select exam</option>
                        {exams.map(e=><option key={e.id} value={e.id} className="bg-[#111]">{e.icon} {e.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Contest #"><input type="number" value={contestForm.contest_number} onChange={e=>setContestForm({...contestForm,contest_number:e.target.value})} className={inp} placeholder="1"/></Field>
                  </div>
                  <Field label="Title *"><input type="text" value={contestForm.title} onChange={e=>setContestForm({...contestForm,title:e.target.value})} className={inp} placeholder="CAT Mock Test #1"/></Field>
                  <Field label="Type">
                    <select value={contestForm.contest_type} onChange={e=>setContestForm({...contestForm,contest_type:e.target.value})} className={sel}>
                      <option value="standard" className="bg-[#111]">Standard</option>
                      <option value="sudden_death" className="bg-[#111]">Sudden Death</option>
                      <option value="flag_mode" className="bg-[#111]">Flag Challenge</option>
                      <option value="practice" className="bg-[#111]">Practice</option>
                    </select>
                  </Field>
                  <Field label="Description"><textarea value={contestForm.description} onChange={e=>setContestForm({...contestForm,description:e.target.value})} rows={2} className={inp} placeholder="Brief description..."/></Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Start Time (IST)"><input type="datetime-local" value={contestForm.start_time} onChange={e=>setContestForm({...contestForm,start_time:e.target.value})} className={inp}/></Field>
                    <Field label="End Time (IST)"><input type="datetime-local" value={contestForm.end_time} onChange={e=>setContestForm({...contestForm,end_time:e.target.value})} className={inp}/></Field>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Duration (min)"><input type="number" value={contestForm.duration_minutes} onChange={e=>setContestForm({...contestForm,duration_minutes:e.target.value})} className={inp} placeholder="180"/></Field>
                    <Field label="Total Questions"><input type="number" value={contestForm.total_questions} onChange={e=>setContestForm({...contestForm,total_questions:parseInt(e.target.value)||0})} className={inp}/></Field>
                    <Field label="Total Marks"><input type="number" value={contestForm.total_marks} onChange={e=>setContestForm({...contestForm,total_marks:parseInt(e.target.value)||0})} className={inp}/></Field>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={contestForm.is_active} onChange={e=>setContestForm({...contestForm,is_active:e.target.checked})} className="accent-orange-500"/><span className="text-gray-400 text-sm">Active</span></label>

                  {/* Sections */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Sections</span>
                      <button onClick={addSection} className="text-orange-400 text-xs font-bold hover:text-orange-300 transition">+ Add</button>
                    </div>
                    <div className="space-y-2">
                      {sections.map((s,i)=>(
                        <div key={i} className="grid grid-cols-3 gap-2 items-center bg-white/3 rounded-xl p-3 border border-white/5">
                          <input placeholder="Section name" value={s.section_name} onChange={e=>handleSectionChange(i,'section_name',e.target.value)} className={`${inp} text-xs`}/>
                          <input type="number" placeholder="Order" value={s.section_order} onChange={e=>handleSectionChange(i,'section_order',e.target.value)} className={`${inp} text-xs`}/>
                          <div className="flex gap-1">
                            <input type="number" placeholder="Time (min)" value={s.time_limit_minutes} onChange={e=>handleSectionChange(i,'time_limit_minutes',e.target.value)} className={`${inp} text-xs flex-1`}/>
                            {sections.length>1&&<button onClick={()=>removeSection(i)} className="text-red-400 hover:text-red-300 px-1.5 text-sm">✕</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Btn onClick={handleContestSubmit} loading={loading} primary>{editingContestId?'Update':'Create'}</Btn>
                    {editingContestId&&<Btn onClick={resetContestForm}>Cancel</Btn>}
                  </div>
                </div>
              </div>

              {/* Contests list */}
              <div className="bg-white/3 border border-white/8 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-black text-base">All Contests</h2>
                  <span className="bg-orange-500/20 text-orange-400 font-black text-xs px-2.5 py-1 rounded-full border border-orange-500/30">{contests.length}</span>
                </div>
                {loading&&!contests.length ? <p className="text-gray-600 text-sm text-center py-10">Loading...</p> : contests.length===0 ? <p className="text-gray-600 text-sm text-center py-10">No contests yet.</p> : (
                  <div className="space-y-2.5 max-h-140 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'#333 transparent'}}>
                    {contests.map(c=>(
                      <div key={c.id} className="bg-white/3 border border-white/8 rounded-2xl p-4 hover:border-orange-500/20 transition">
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-white font-bold text-sm flex-1 leading-tight">{c.exams?.icon} {c.title}</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg shrink-0 ${c.is_active?'bg-emerald-500/15 text-emerald-400':'bg-gray-700/50 text-gray-500'}`}>{c.is_active?'Live':'Off'}</span>
                        </div>
                        <div className="flex gap-2 text-[10px] text-gray-600 mb-3 flex-wrap">
                          <span>#{c.contest_number}</span><span>•</span><span>{c.contest_type}</span><span>•</span><span>{c.duration_minutes}m</span><span>•</span><span>{c.total_questions}Q</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>handleContestEdit(c)} className="flex-1 py-1.5 rounded-xl bg-orange-500/15 text-orange-400 text-xs font-bold hover:bg-orange-500/25 transition">Edit</button>
                          <button onClick={()=>handleContestDelete(c.id)} className="flex-1 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ QUESTIONS TAB ══ */}
          {activeTab==='questions' && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

              {/* Question Form */}
              <div className="xl:col-span-3 space-y-4">
                {/* Accordions – Steps 1-6 */}
                {[1,2,3,4,5,6].map(step=>(
                  <div key={step} className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
                    <StepHeader step={step} currentStep={currentStep} setCurrentStep={setCurrentStep} labels={['Exam & Topic','Contest & Section','Question Text','Marks & Type','Meta','Solution']}/>
                    {currentStep===step && (
                      <div className="p-5 space-y-4 border-t border-white/5">
                        {step===1 && <>
                          <Field label="Exam *">
                            <select name="exam_id" value={formData.exam_id} onChange={handleChange} className={sel}>
                              <option value="">Select exam</option>
                              {exams.map(e=><option key={e.id} value={e.id} className="bg-[#111]">{e.icon} {e.name}</option>)}
                            </select>
                          </Field>
                          <div className="grid grid-cols-3 gap-3">
                            <Field label="Subject">
                              <input list="subjects" name="subject" value={formData.subject} onChange={handleChange} className={inp} placeholder="Quantitative"/>
                              <datalist id="subjects">{subjectSuggestions.map(s=><option key={s} value={s}/>)}</datalist>
                            </Field>
                            <Field label="Chapter">
                              <input list="chapters" name="chapter" value={formData.chapter} onChange={handleChange} className={inp} placeholder="Arithmetic"/>
                              <datalist id="chapters">{chapterSuggestions.map(s=><option key={s} value={s}/>)}</datalist>
                            </Field>
                            <Field label="Topic">
                              <input list="topics" name="topic" value={formData.topic} onChange={handleChange} className={inp} placeholder="Percentages"/>
                              <datalist id="topics">{topicSuggestions.map(s=><option key={s} value={s}/>)}</datalist>
                            </Field>
                          </div>
                        </>}

                        {step===2 && <>
                          <div className="grid grid-cols-2 gap-4">
                            <Field label="Contest">
                              <select name="contest_id" value={formData.contest_id} onChange={handleChange} className={sel}>
                                <option value="">None</option>
                                {contests.map(c=><option key={c.id} value={c.id} className="bg-[#111]">#{c.contest_number} {c.title}</option>)}
                              </select>
                            </Field>
                            <Field label="Section">
                              <select name="contest_section_id" value={formData.contest_section_id} onChange={handleChange} className={sel}>
                                <option value="">None</option>
                                {contestSections.map(s=><option key={s.id} value={s.id} className="bg-[#111]">{s.section_name}</option>)}
                              </select>
                            </Field>
                          </div>
                          <Field label="Q Number"><input type="number" name="question_number" value={formData.question_number} onChange={handleChange} className={inp} placeholder="1"/></Field>
                        </>}

                        {step===3 && <>
                          <Field label="Question Text *"><textarea name="question_text" value={formData.question_text} onChange={handleChange} rows={4} className={inp} placeholder="Enter question (supports $LaTeX$)"/></Field>
                          <Field label="Question Image">
                            <input type="file" accept="image/*" onChange={handleQuestionImageUpload} className="text-sm text-gray-400"/>
                            {questionImagePreview && <img src={questionImagePreview} alt="preview" className="mt-2 rounded-xl max-h-32 object-contain border border-white/10"/>}
                          </Field>
                          <div className="grid grid-cols-2 gap-4">
                            <Field label="Type">
                              <select name="question_type" value={formData.question_type} onChange={handleChange} className={sel}>
                                <option value="mcq" className="bg-[#111]">MCQ</option>
                                <option value="multiple_correct" className="bg-[#111]">Multi-Correct</option>
                                <option value="numerical" className="bg-[#111]">Numerical (TITA)</option>
                              </select>
                            </Field>
                            <Field label="Difficulty">
                              <select name="difficulty" value={formData.difficulty} onChange={handleChange} className={sel}>
                                <option value="easy" className="bg-[#111]">Easy</option>
                                <option value="medium" className="bg-[#111]">Medium</option>
                                <option value="hard" className="bg-[#111]">Hard</option>
                              </select>
                            </Field>
                          </div>

                          {/* Options */}
                          {formData.question_type!=='numerical' && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Options</span>
                                <button onClick={addOption} className="text-orange-400 text-xs font-bold hover:text-orange-300">+ Add</button>
                              </div>
                              <div className="space-y-2">
                                {options.map((opt,i)=>(
                                  <div key={i} className="flex items-center gap-2 bg-white/3 rounded-xl p-3 border border-white/5">
                                    <span className="text-gray-500 font-black text-sm w-5">{opt.option_label}</span>
                                    <input type="text" value={opt.option_text} onChange={e=>handleOptionChange(i,'option_text',e.target.value)} placeholder={`Option ${opt.option_label}`} className={`${inp} flex-1 text-xs`}/>
                                    <label className="flex items-center gap-1 cursor-pointer shrink-0">
                                      <input type="checkbox" checked={opt.is_correct} onChange={e=>handleOptionChange(i,'is_correct',e.target.checked)} className="accent-emerald-500"/>
                                      <span className="text-[10px] text-gray-500">Correct</span>
                                    </label>
                                    {options.length>2&&<button onClick={()=>removeOption(i)} className="text-red-400 text-xs">✕</button>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {formData.question_type==='numerical' && (
                            <div className="grid grid-cols-2 gap-4">
                              <Field label="Answer"><input type="number" name="numerical_answer" value={formData.numerical_answer} onChange={handleChange} step="any" className={inp} placeholder="Exact answer"/></Field>
                              <Field label="Tolerance"><input type="number" name="numerical_tolerance" value={formData.numerical_tolerance} onChange={handleChange} step="any" className={inp} placeholder="0.01"/></Field>
                            </div>
                          )}
                        </>}

                        {step===4 && <>
                          <div className="grid grid-cols-3 gap-4">
                            <Field label="+ve Marks"><input type="number" name="positive_marks" value={formData.positive_marks} onChange={handleChange} step="any" className={inp} placeholder="3"/></Field>
                            <Field label="-ve Marks"><input type="number" name="negative_marks" value={formData.negative_marks} onChange={handleChange} step="any" className={inp} placeholder="1"/></Field>
                            <Field label="Partial"><input type="number" name="partial_marks" value={formData.partial_marks} onChange={handleChange} step="any" className={inp} placeholder="0"/></Field>
                          </div>
                        </>}

                        {step===5 && <>
                          <div className="grid grid-cols-2 gap-4">
                            <Field label="Source"><input name="source" value={formData.source} onChange={handleChange} className={inp} placeholder="CAT 2022, XAT 2023..."/></Field>
                            <Field label="Tags (comma-sep)"><input name="tags" value={formData.tags} onChange={handleChange} className={inp} placeholder="percentages, profit-loss"/></Field>
                          </div>
                          <Field label="Visibility">
                            <select name="visibility" value={formData.visibility} onChange={handleChange} className={sel}>
                              <option value="practice" className="bg-[#111]">Practice</option>
                              <option value="contest_only" className="bg-[#111]">Contest Only</option>
                              <option value="hidden" className="bg-[#111]">Hidden</option>
                              <option value="contest+practice" className="bg-[#111]">Contest + Practice</option>
                              <option value="practice_after_contest" className="bg-[#111]">Practice After Contest</option>
                            </select>
                          </Field>
                        </>}

                        {step===6 && <>
                          <Field label="Solution Text"><textarea value={solution.solution_text} onChange={e=>setSolution(p=>({...p,solution_text:e.target.value}))} rows={4} className={inp} placeholder="Step-by-step explanation..."/></Field>
                          <Field label="Solution Image">
                            <input type="file" accept="image/*" onChange={handleSolutionImageUpload} className="text-sm text-gray-400"/>
                            {solutionImagePreview&&<img src={solutionImagePreview} alt="sol" className="mt-2 rounded-xl max-h-32 object-contain border border-white/10"/>}
                          </Field>
                          <Field label="Solution Video">
                            <input type="file" accept="video/*" onChange={handleSolutionVideoUpload} className="text-sm text-gray-400"/>
                            {solutionVideoName&&<p className="text-emerald-400 text-xs mt-1">✅ {solutionVideoName}</p>}
                          </Field>
                        </>}
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex gap-3">
                  <Btn onClick={handleQuestionSubmit} loading={loading} primary>{editingQuestionId?'Update Question':'Save Question'}</Btn>
                  {editingQuestionId&&<Btn onClick={resetQuestionForm}>Cancel</Btn>}
                </div>
              </div>

              {/* Question list */}
              <div className="xl:col-span-2 bg-white/[0.03] border border-white/8 rounded-3xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-black text-base">Questions</h2>
                  <span className="bg-orange-500/20 text-orange-400 font-black text-xs px-2.5 py-1 rounded-full border border-orange-500/30">{filteredQuestions.length}</span>
                </div>

                {/* Filters */}
                <div className="space-y-2 mb-4">
                  <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search questions..." className={`${inp} text-xs`}/>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={filterExam} onChange={e=>setFilterExam(e.target.value)} className={`${sel} text-xs`}>
                      <option value="" className="bg-[#111]">All Exams</option>
                      {exams.map(e=><option key={e.id} value={e.id} className="bg-[#111]">{e.icon} {e.name}</option>)}
                    </select>
                    <select value={filterSubject} onChange={e=>setFilterSubject(e.target.value)} className={`${sel} text-xs`}>
                      <option value="" className="bg-[#111]">All Subjects</option>
                      {uniqueSubjects.map(s=><option key={s} value={s} className="bg-[#111]">{s}</option>)}
                    </select>
                  </div>
                </div>

                {loading ? <p className="text-gray-600 text-sm text-center py-10">Loading...</p> : filteredQuestions.length===0 ? <p className="text-gray-600 text-sm text-center py-10">No questions found.</p> : (
                  <div className="space-y-2 max-h-[680px] overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'#333 transparent'}}>
                    {filteredQuestions.map((q,i)=>(
                      <div key={q.id} className="bg-white/3 border border-white/6 rounded-2xl p-3.5 hover:border-orange-500/20 transition">
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-gray-600 text-[10px] font-black w-5 flex-shrink-0 mt-0.5">#{i+1}</span>
                          <p className="text-white/80 text-xs leading-relaxed flex-1 line-clamp-2">{q.question_text}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-7 mb-2 flex-wrap">
                          {q.exams?.icon&&<span className="text-xs">{q.exams.icon}</span>}
                          {q.subject&&<span className="text-[9px] text-gray-600 font-bold bg-white/3 px-1.5 py-0.5 rounded-lg">{q.subject}</span>}
                          {q.difficulty&&<span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${q.difficulty==='easy'?'text-emerald-400 bg-emerald-500/10':q.difficulty==='hard'?'text-red-400 bg-red-500/10':'text-yellow-400 bg-yellow-500/10'}`}>{q.difficulty}</span>}
                          <span className="text-[9px] text-gray-600 font-bold">{q.question_type?.toUpperCase()}</span>
                        </div>
                        <div className="flex gap-2 ml-7">
                          <button onClick={()=>handleQuestionEdit(q)} className="flex-1 py-1 rounded-lg bg-orange-500/15 text-orange-400 text-[10px] font-black hover:bg-orange-500/25 transition">Edit</button>
                          <button onClick={()=>handleQuestionDelete(q.id)} className="flex-1 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-black hover:bg-red-500/20 transition">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* ══ STUDY ROOM TAB ══ */}
          {activeTab==='study' && (
            <div>
              {studyView==='list' ? (
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                    <div>
                      <h2 className="text-white font-black text-lg">Study Topics</h2>
                      <p className="text-gray-600 text-xs mt-0.5">PDF · Video · Practice Questions</p>
                    </div>
                    <div className="flex gap-2">
                      <input value={studySearch} onChange={e=>setStudySearch(e.target.value)} placeholder="Search topics…"
                        className={`${inp} w-48 text-xs`}/>
                      {(['all','qa','dilr','varc'] as const).map(s=>(
                        <button key={s} onClick={()=>setStudyFilterSec(s)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition ${studyFilterSec===s?'bg-orange-500 text-white':'bg-white/5 border border-white/8 text-gray-500 hover:text-gray-300'}`}>
                          {s==='all'?'All':s.toUpperCase()}
                        </button>
                      ))}
                      <button onClick={()=>{resetStudyForm();setStudyView('form');}}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-xs rounded-xl shadow-[0_0_12px_rgba(249,115,22,0.25)]">
                        + New Topic
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {[
                      {l:'Total',  v:studyTopics.length,                                        c:'text-white'},
                      {l:'Quants', v:studyTopics.filter(t=>t.subject_section==='qa').length,    c:'text-orange-400'},
                      {l:'DILR',   v:studyTopics.filter(t=>t.subject_section==='dilr').length,  c:'text-blue-400'},
                      {l:'Verbal', v:studyTopics.filter(t=>t.subject_section==='varc').length,  c:'text-emerald-400'},
                    ].map(s=>(
                      <div key={s.l} className="bg-white/3 border border-white/8 rounded-2xl p-4 text-center">
                        <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
                        <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-0.5">{s.l}</p>
                      </div>
                    ))}
                  </div>

                  {/* List */}
                  {studyLoading ? (
                    <p className="text-gray-600 text-center py-10">Loading…</p>
                  ) : studyTopics.filter(t=>(studyFilterSec==='all'||t.subject_section===studyFilterSec)&&(!studySearch||t.topic.toLowerCase().includes(studySearch.toLowerCase()))).length===0 ? (
                    <p className="text-gray-600 text-center py-10 text-sm">No topics yet — create your first one.</p>
                  ) : (
                    <div className="space-y-2">
                      {studyTopics
                        .filter(t=>(studyFilterSec==='all'||t.subject_section===studyFilterSec)&&(!studySearch||t.topic.toLowerCase().includes(studySearch.toLowerCase())))
                        .map((t:any)=>(
                        <div key={t.id} className="bg-white/3 border border-white/8 rounded-2xl p-4 flex items-center gap-4 group hover:border-orange-500/20 transition">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-black ${t.subject_section==='qa'?'bg-orange-500':t.subject_section==='dilr'?'bg-blue-500':'bg-emerald-500'}`}>
                            {t.subject_section.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-white font-black text-sm truncate">{t.topic}</span>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${t.is_published?'bg-emerald-500/15 text-emerald-400 border-emerald-500/25':'bg-gray-500/15 text-gray-500 border-gray-500/25'}`}>
                                {t.is_published?'Live':'Draft'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-gray-600 flex-wrap">
                              <span className="font-bold uppercase">{t.subject_section}</span>
                              <span>·</span><span>{t.module}</span>
                              {t.pdf_url&&<span>📄 PDF</span>}
                              {t.video_url&&<span>🎬 Video</span>}
                              <span>❓ {t.question_count} Q</span>
                              <span>⏱ {t.estimated_mins}m</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={()=>toggleStudyPublish(t)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition ${t.is_published?'bg-gray-500/10 border-gray-500/20 text-gray-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20':'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'}`}>
                              {t.is_published?'Unpublish':'Publish'}
                            </button>
                            <a href={`/study/${t.id}`} target="_blank" rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-white/5 border border-white/10 text-gray-400 hover:text-white transition">
                              Preview
                            </a>
                            <button onClick={()=>openStudyEdit(t)}
                              className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-orange-500/15 border border-orange-500/25 text-orange-400 hover:bg-orange-500/25 transition">
                              Edit
                            </button>
                            <button onClick={()=>setDeleteConfirm({type:'exam',id:t.id,name:t.topic})}
                              className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition">
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* ── FORM ── */
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                  {/* LEFT — Topic metadata */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-white font-black text-lg">{studyEditId?'Edit Topic':'New Topic'}</h2>
                      <button onClick={()=>{resetStudyForm();setStudyView('list');}} className="text-gray-500 hover:text-white text-xs font-bold transition">← Back to list</button>
                    </div>

                    {/* Section */}
                    <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Section</p>
                      <div className="flex gap-2">
                        {(['qa','dilr','varc'] as const).map(s=>(
                          <button key={s} onClick={()=>setStudyForm(f=>({...f,subject_section:s,module:'',topic:''}))}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition ${studyForm.subject_section===s?s==='qa'?'bg-orange-500 text-white':s==='dilr'?'bg-blue-500 text-white':'bg-emerald-500 text-white':'bg-white/5 border border-white/8 text-gray-500 hover:text-gray-300'}`}>
                            {s==='qa'?'Quants':s==='dilr'?'DILR':'Verbal'}
                          </button>
                        ))}
                      </div>

                      {/* Module */}
                      <Field label="Module *">
                        <select value={studyForm.module} onChange={e=>setStudyForm(f=>({...f,module:e.target.value,topic:''}))} className={sel}>
                          <option value="">Select module</option>
                          {(SD_MODULES[studyForm.subject_section]??[]).map((m:string)=><option key={m} value={m} className="bg-[#111]">{m}</option>)}
                        </select>
                      </Field>

                      {/* Topic */}
                      <Field label="Topic *">
                        <select value={studyForm.topic} onChange={e=>setStudyForm(f=>({...f,topic:e.target.value}))} className={sel} disabled={!studyForm.module}>
                          <option value="">Select topic</option>
                          {(SD_TOPICS[studyForm.subject_section]?.[studyForm.module]??[]).map((t:string)=><option key={t} value={t} className="bg-[#111]">{t}</option>)}
                        </select>
                        <input value={studyForm.topic} onChange={e=>setStudyForm(f=>({...f,topic:e.target.value}))} placeholder="Or type a custom topic name…" className={`${inp} mt-2 text-xs`}/>
                      </Field>

                      <Field label="Description">
                        <textarea value={studyForm.description} onChange={e=>setStudyForm(f=>({...f,description:e.target.value}))} rows={2} className={inp} placeholder="Short blurb shown on the topic card…"/>
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Difficulty">
                          <select value={studyForm.difficulty} onChange={e=>setStudyForm(f=>({...f,difficulty:e.target.value}))} className={sel}>
                            <option value="easy" className="bg-[#111]">Easy</option>
                            <option value="moderate" className="bg-[#111]">Moderate</option>
                            <option value="hard" className="bg-[#111]">Hard</option>
                          </select>
                        </Field>
                        <Field label="Est. Time (min)">
                          <input type="number" value={studyForm.estimated_mins} onChange={e=>setStudyForm(f=>({...f,estimated_mins:parseInt(e.target.value)||0}))} className={inp} min={1} max={180}/>
                        </Field>
                      </div>

                      <button onClick={()=>setStudyForm(f=>({...f,is_published:!f.is_published}))}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition ${studyForm.is_published?'bg-emerald-500/10 border-emerald-500/25 text-emerald-400':'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}>
                        <span>{studyForm.is_published?'✅ Published — visible to students':'🔒 Draft — hidden from students'}</span>
                        <span>{studyForm.is_published?'👁':'🔒'}</span>
                      </button>
                    </div>

                    {/* PDF */}
                    <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-3">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">📄 PDF Material</p>
                      <Field label="PDF URL (paste Google Drive / Supabase link)">
                        <input value={studyForm.pdf_url} onChange={e=>setStudyForm(f=>({...f,pdf_url:e.target.value}))} className={`${inp} font-mono text-xs`} placeholder="https://…pdf"/>
                      </Field>
                      <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/5"/><span className="text-gray-700 text-[10px] font-bold">OR UPLOAD</span><div className="flex-1 h-px bg-white/5"/></div>
                      <Field label="Upload PDF file">
                        <input type="file" accept=".pdf" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onloadend=()=>setStudyPdfFile(r.result as string);r.readAsDataURL(f);}} className="text-sm text-gray-400"/>
                        {studyPdfFile&&<p className="text-emerald-400 text-xs mt-1">✅ PDF selected — will upload on save</p>}
                      </Field>
                    </div>

                    {/* Video */}
                    <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-3">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">🎬 Video Lecture</p>
                      <div className="flex gap-2 mb-2">
                        {(['youtube','upload'] as const).map(v=>(
                          <button key={v} onClick={()=>setStudyForm(f=>({...f,video_type:v}))}
                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition ${studyForm.video_type===v?'bg-blue-600 text-white':'bg-white/5 border border-white/8 text-gray-500 hover:text-gray-300'}`}>
                            {v==='youtube'?'YouTube URL':'Upload File'}
                          </button>
                        ))}
                      </div>
                      {studyForm.video_type==='youtube'?(
                        <Field label="YouTube URL">
                          <input value={studyForm.video_url} onChange={e=>setStudyForm(f=>({...f,video_url:e.target.value}))} className={`${inp} font-mono text-xs`} placeholder="https://youtube.com/watch?v=…"/>
                        </Field>
                      ):(
                        <Field label="Upload video file (MP4/WebM)">
                          <input type="file" accept="video/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;setStudyVideoName(f.name);const r=new FileReader();r.onloadend=()=>setStudyVideoFile(r.result as string);r.readAsDataURL(f);}} className="text-sm text-gray-400"/>
                          {studyVideoFile&&<p className="text-emerald-400 text-xs mt-1">✅ {studyVideoName}</p>}
                        </Field>
                      )}
                    </div>
                  </div>

                  {/* RIGHT — Practice questions */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-black">Practice Questions</h3>
                      <span className="text-gray-600 text-[10px] font-bold">No negative marking</span>
                    </div>

                    {studyQList.map((q:any,idx:number)=>(
                      <div key={q.uid} className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full">Q {idx+1}</span>
                            <div className="flex bg-white/5 p-0.5 rounded-lg">
                              {(['mcq','tita'] as const).map(t=>(
                                <button key={t} onClick={()=>setStudyQList((qs:any[])=>qs.map((qx,i)=>i===idx?{...qx,type:t,correct:t==='tita'?'':qx.correct}:qx))}
                                  className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition ${q.type===t?'bg-orange-500 text-white':'text-gray-600 hover:text-gray-400'}`}>{t}</button>
                              ))}
                            </div>
                            <select value={q.difficulty} onChange={e=>setStudyQList((qs:any[])=>qs.map((qx,i)=>i===idx?{...qx,difficulty:e.target.value}:qx))} className="bg-white/5 border-none rounded-lg px-2 py-1 text-[9px] font-black text-gray-400 outline-none">
                              <option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option>
                            </select>
                          </div>
                          <button onClick={()=>setStudyQList((qs:any[])=>qs.filter((_:any,i:number)=>i!==idx))} disabled={studyQList.length===1}
                            className="text-gray-700 hover:text-red-400 transition disabled:opacity-30 text-xs">✕</button>
                        </div>

                        <textarea value={q.text} onChange={e=>setStudyQList((qs:any[])=>qs.map((qx,i)=>i===idx?{...qx,text:e.target.value}:qx))}
                          placeholder="Question text… $LaTeX$ supported" rows={2}
                          className={`${inp} text-sm`}/>

                        {q.type==='mcq'&&(
                          <div className="grid grid-cols-2 gap-2">
                            {q.options.map((opt:any)=>(
                              <div key={opt.id} className={`flex items-center gap-2 bg-white/[0.03] p-2 rounded-xl border transition ${q.correct===opt.id?'border-orange-500/50':'border-white/5'}`}>
                                <button onClick={()=>setStudyQList((qs:any[])=>qs.map((qx,i)=>i===idx?{...qx,correct:opt.id}:qx))}
                                  className={`w-6 h-6 rounded-lg text-[10px] font-black flex-shrink-0 transition ${q.correct===opt.id?'bg-orange-500 text-white':'bg-white/5 text-gray-600 hover:text-gray-400'}`}>{opt.id}</button>
                                <input value={opt.t} onChange={e=>setStudyQList((qs:any[])=>qs.map((qx,i)=>i===idx?{...qx,options:qx.options.map((o:any)=>o.id===opt.id?{...o,t:e.target.value}:o)}:qx))}
                                  className="bg-transparent border-none outline-none text-xs text-gray-300 flex-1" placeholder={`Option ${opt.id}`}/>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type==='tita'&&(
                          <input value={q.correct} onChange={e=>setStudyQList((qs:any[])=>qs.map((qx,i)=>i===idx?{...qx,correct:e.target.value}:qx))}
                            placeholder="Correct numerical answer" className={`${inp} font-mono text-sm`}/>
                        )}

                        <details className="group">
                          <summary className="text-[10px] font-black uppercase text-emerald-400 cursor-pointer select-none list-none flex items-center gap-1">
                            <span className="text-emerald-400/50 group-open:text-emerald-400 transition">▶</span> Solution {(q.sol_text)&&'(Added)'}
                          </summary>
                          <div className="mt-3 space-y-2">
                            <textarea value={q.sol_text} onChange={e=>setStudyQList((qs:any[])=>qs.map((qx,i)=>i===idx?{...qx,sol_text:e.target.value}:qx))}
                              placeholder="Solution explanation…" rows={2} className={`${inp} text-xs`}/>
                            <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onloadend=()=>setStudyQList((qs:any[])=>qs.map((qx,i)=>i===idx?{...qx,sol_image:r.result as string}:qx));r.readAsDataURL(f);}} className="text-xs text-gray-500"/>
                          </div>
                        </details>
                      </div>
                    ))}

                    <button onClick={()=>setStudyQList((qs:any[])=>[...qs,blankStudyQ()])}
                      className="w-full py-3 rounded-2xl border border-dashed border-white/10 text-gray-500 text-xs font-bold hover:border-orange-500/30 hover:text-orange-400 transition">
                      + Add Question
                    </button>

                    <Btn onClick={handleStudySave} loading={loading} primary>
                      {studyEditId?'Update Topic':'Publish Topic'}
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    
      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-gray-500 text-sm mb-5">
              Permanently delete <span className="font-bold text-gray-900">"{deleteConfirm.name}"</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'study') doStudyDelete(deleteConfirm.id);
                  else if (deleteConfirm.type === 'exam') handleExamDelete(deleteConfirm.id);
                  else if (deleteConfirm.type === 'contest') handleContestDelete(deleteConfirm.id);
                  else handleQuestionDelete(deleteConfirm.id);
                }}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition disabled:opacity-50">
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminGuard>
  );
}

// ── Shared style constants ─────────────────────────────────────
const inp = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-orange-500/40 transition resize-none";
const sel = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500/40 transition";

function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <div><label className="block text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1.5">{label}</label>{children}</div>;
}
function Btn({onClick,loading,primary,children}:{onClick:any;loading?:boolean;primary?:boolean;children:React.ReactNode}) {
  return <button onClick={onClick} disabled={loading} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all disabled:opacity-50 ${primary?'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.25)] hover:opacity-90':'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'}`}>{loading?'Processing...':children}</button>;
}
