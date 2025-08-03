import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  deleteDoc,
  updateDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Ícones modernos
import {
  LogOut,
  UserPlus,
  LogIn,
  Save,
  Trash2,
  Loader,
  Edit,
  Upload,
  DollarSign,
  HardHat,
  ClipboardList,
  Image
} from 'lucide-react';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const appId = "SEU_APP_ID";
const initialAuthToken = null;

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const App = () => {
  // Estados para autenticação
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  // Estados para obras
  const [obras, setObras] = useState([]);
  const [nomeObra, setNomeObra] = useState('');
  const [valorObra, setValorObra] = useState('');
  const [valorServicos, setValorServicos] = useState('');
  const [valorVales, setValorVales] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  // Estados para recibos
  const [recibos, setRecibos] = useState([]);
  const [uploadingRecibo, setUploadingRecibo] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedObraForRecibo, setSelectedObraForRecibo] = useState('');

  // Efeito para autenticação
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    if (initialAuthToken) {
      signInWithCustomToken(auth, initialAuthToken).catch(e => {
        console.error("Erro ao fazer login com token:", e);
      });
    }

    return () => unsubscribeAuth();
  }, []);

  // Efeito para carregar obras
  useEffect(() => {
    if (!user) {
      setObras([]);
      return;
    }

    const userId = user.uid;
    const obrasRef = collection(db, 'artifacts', appId, 'users', userId, 'obras');
    const q = query(obrasRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const obrasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setObras(obrasData);
    });

    return () => unsubscribe();
  }, [user]);

  // Efeito para carregar recibos
  useEffect(() => {
    if (!user) {
      setRecibos([]);
      return;
    }

    const userId = user.uid;
    const recibosRef = collection(db, 'artifacts', appId, 'users', userId, 'recibos');
    const q = query(recibosRef, orderBy('uploadedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recibosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecibos(recibosData);
    });

    return () => unsubscribe();
  }, [user]);

  // Funções de autenticação
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
      handleAuthError(e);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      handleAuthError(e);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (e) {
      setError("Erro ao sair. Tente novamente.");
    }
  };

  const handleAuthError = (e) => {
    console.error("Erro de autenticação:", e.message);
    switch (e.code) {
      case 'auth/email-already-in-use':
        setError("O e-mail já está em uso. Tente fazer login.");
        break;
      case 'auth/weak-password':
        setError("A senha é muito fraca. Use pelo menos 6 caracteres.");
        break;
      case 'auth/invalid-email':
        setError("O e-mail é inválido.");
        break;
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        setError("E-mail ou senha incorretos.");
        break;
      default:
        setError("Erro na operação. Tente novamente.");
    }
  };

  // Funções de gerenciamento de obras
  const salvarObra = async () => {
    if (!nomeObra.trim()) {
      setError("O nome da obra é obrigatório");
      return;
    }

    if (!user) {
      setError("Você precisa estar logado para salvar obras.");
      return;
    }

    try {
      const obraData = {
        nome: nomeObra,
        valor: valorObra || 0,
        servicos: valorServicos || 0,
        vales: valorVales || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const userId = user.uid;
      const obrasRef = collection(db, 'artifacts', appId, 'users', userId, 'obras');

      if (editingId) {
        const docRef = doc(db, 'artifacts', appId, 'users', userId, 'obras', editingId);
        await updateDoc(docRef, obraData);
        setEditingId(null);
      } else {
        await addDoc(obrasRef, obraData);
      }

      setNomeObra('');
      setValorObra('');
      setValorServicos('');
      setValorVales('');
    } catch (e) {
      console.error("Erro ao salvar obra:", e);
      setError("Não foi possível salvar a obra. Tente novamente.");
    }
  };

  const editarObra = (obra) => {
    setNomeObra(obra.nome);
    setValorObra(obra.valor);
    setValorServicos(obra.servicos);
    setValorVales(obra.vales);
    setEditingId(obra.id);
  };

  const cancelarEdicao = () => {
    setNomeObra('');
    setValorObra('');
    setValorServicos('');
    setValorVales('');
    setEditingId(null);
  };

  const deletarObra = async (id) => {
    if (!user) {
      setError("Você precisa estar logado para deletar obras.");
      return;
    }

    if (!window.confirm("Tem certeza que deseja excluir esta obra?")) {
      return;
    }

    try {
      const userId = user.uid;
      const docRef = doc(db, 'artifacts', appId, 'users', userId, 'obras', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.error("Erro ao deletar obra:", e);
      setError("Não foi possível deletar a obra.");
    }
  };

  // Funções para gerenciar recibos
  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const uploadRecibo = async () => {
    if (!selectedFile || !selectedObraForRecibo) {
      setError("Selecione uma obra e um arquivo para upload.");
      return;
    }

    setUploadingRecibo(true);
    setError(null);

    try {
      const userId = user.uid;
      const storageRef = ref(storage, `recibos/${userId}/${Date.now()}_${selectedFile.name}`);
      const snapshot = await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const recibosRef = collection(db, 'artifacts', appId, 'users', userId, 'recibos');
      await addDoc(recibosRef, {
        obraId: selectedObraForRecibo,
        url: downloadURL,
        nome: selectedFile.name,
        uploadedAt: serverTimestamp()
      });

      setSelectedFile(null);
      setSelectedObraForRecibo('');
    } catch (e) {
      console.error("Erro ao fazer upload:", e);
      setError("Falha no upload do recibo. Tente novamente.");
    } finally {
      setUploadingRecibo(false);
    }
  };

  const deletarRecibo = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este recibo?")) {
      return;
    }

    try {
      const userId = user.uid;
      const docRef = doc(db, 'artifacts', appId, 'users', userId, 'recibos', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.error("Erro ao deletar recibo:", e);
      setError("Não foi possível deletar o recibo.");
    }
  };

  // Formatação de valores monetários
  const formatCurrency = (value) => {
    return parseFloat(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // UI de carregamento
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="flex items-center text-white text-2xl animate-pulse">
          <Loader className="animate-spin mr-3" />
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans p-4">
      <div className="max-w-6xl mx-auto">
        {/* Cabeçalho */}
        <header className="bg-gray-800 rounded-xl shadow-2xl p-6 mb-6 border border-gray-700">
          <h1 className="text-3xl font-bold text-center text-purple-400 mb-2">
            <HardHat className="inline mr-2" />
            Sistema de Gerenciamento de Obras
          </h1>
          {user && (
            <div className="flex justify-between items-center mt-4">
              <p className="text-gray-400">Logado como: <span className="text-white">{user.email}</span></p>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-all duration-300 shadow-md hover:shadow-red-500/30 flex items-center"
              >
                <LogOut className="mr-2" size={18} />
                Sair
              </button>
            </div>
          )}
        </header>

        {/* Exibe erros se houver */}
        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6 text-center animate-fade-in">
            {error}
          </div>
        )}

        {/* Conteúdo condicional (Login/Cadastro vs. Dashboard) */}
        {!user ? (
          // Formulário de Login/Cadastro
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md mx-auto border border-gray-700">
            <div className="flex justify-center mb-6">
              <button
                onClick={() => setIsLoginMode(true)}
                className={`px-6 py-2 rounded-l-full text-lg font-semibold transition-colors duration-300 ${isLoginMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLoginMode(false)}
                className={`px-6 py-2 rounded-r-full text-lg font-semibold transition-colors duration-300 ${!isLoginMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
              >
                Cadastrar
              </button>
            </div>
            
            <form onSubmit={isLoginMode ? handleSignIn : handleSignUp} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu_email@exemplo.com"
                  className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha (mínimo 6 caracteres)"
                  className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full p-3 mt-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg transition-all duration-300 flex items-center justify-center space-x-2 hover:shadow-purple-500/30"
              >
                {isLoginMode ? (
                  <>
                    <LogIn size={20} />
                    <span>Entrar</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    <span>Cadastrar</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          // Dashboard do usuário logado
          <div className="space-y-6">
            {/* Seção de cadastro/edição de obras */}
            <section className="bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-4 text-purple-400 flex items-center">
                <ClipboardList className="mr-2" />
                {editingId ? 'Editar Obra' : 'Cadastrar Nova Obra'}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Nome da Obra*</label>
                  <input
                    type="text"
                    value={nomeObra}
                    onChange={(e) => setNomeObra(e.target.value)}
                    placeholder="Nome da obra"
                    className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Valor Total (R$)</label>
                  <input
                    type="number"
                    value={valorObra}
                    onChange={(e) => setValorObra(e.target.value)}
                    placeholder="Valor total da obra"
                    className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Valor em Serviços (R$)</label>
                  <input
                    type="number"
                    value={valorServicos}
                    onChange={(e) => setValorServicos(e.target.value)}
                    placeholder="Valor em serviços"
                    className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Valor em Vales (R$)</label>
                  <input
                    type="number"
                    value={valorVales}
                    onChange={(e) => setValorVales(e.target.value)}
                    placeholder="Valor em vales"
                    className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    step="0.01"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                {editingId && (
                  <button
                    onClick={cancelarEdicao}
                    className="bg-gray-600 hover:bg-gray-500 text-white py-2 px-6 rounded-lg transition-all duration-300 shadow-md"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={salvarObra}
                  className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-500/30 flex items-center"
                >
                  <Save className="mr-2" size={18} />
                  {editingId ? 'Atualizar Obra' : 'Salvar Obra'}
                </button>
              </div>
            </section>

            {/* Lista de obras cadastradas */}
            <section className="bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-4 text-purple-400 flex items-center">
                <HardHat className="mr-2" />
                Obras Cadastradas
              </h2>
              
              {obras.length === 0 ? (
                <p className="text-gray-400 text-center p-6 bg-gray-700/50 rounded-lg">
                  Nenhuma obra cadastrada ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-700 text-gray-300">
                        <th className="p-3 text-left rounded-tl-lg">Obra</th>
                        <th className="p-3 text-right">Valor Total</th>
                        <th className="p-3 text-right">Serviços</th>
                        <th className="p-3 text-right">Vales</th>
                        <th className="p-3 text-right rounded-tr-lg">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obras.map((obra, index) => (
                        <tr 
                          key={obra.id} 
                          className={`border-b border-gray-700 ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}
                        >
                          <td className="p-3">{obra.nome}</td>
                          <td className="p-3 text-right">{formatCurrency(obra.valor)}</td>
                          <td className="p-3 text-right">{formatCurrency(obra.servicos)}</td>
                          <td className="p-3 text-right">{formatCurrency(obra.vales)}</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => editarObra(obra)}
                                className="text-blue-400 hover:text-blue-300 p-1 rounded-full hover:bg-gray-700 transition-colors"
                                title="Editar"
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => deletarObra(obra.id)}
                                className="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-gray-700 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Seção de upload de recibos */}
            <section className="bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-4 text-purple-400 flex items-center">
                <Image className="mr-2" />
                Gerenciar Recibos
              </h2>
              
              <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium mb-3 text-gray-300">Enviar Novo Recibo</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-300 mb-2">Selecione a Obra</label>
                    <select
                      value={selectedObraForRecibo}
                      onChange={(e) => setSelectedObraForRecibo(e.target.value)}
                      className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    >
                      <option value="">Selecione uma obra</option>
                      {obras.map(obra => (
                        <option key={obra.id} value={obra.id}>{obra.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Selecione o Arquivo</label>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                      className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    />
                  </div>
                </div>
                
                <button
                  onClick={uploadRecibo}
                  disabled={uploadingRecibo || !selectedFile || !selectedObraForRecibo}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg transition-all duration-300 shadow-md hover:shadow-green-500/30 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="mr-2" size={18} />
                  {uploadingRecibo ? 'Enviando...' : 'Enviar Recibo'}
                </button>
              </div>
              
              <h3 className="text-lg font-medium mb-3 text-gray-300">Recibos Enviados</h3>
              
              {recibos.length === 0 ? (
                <p className="text-gray-400 text-center p-6 bg-gray-700/50 rounded-lg">
                  Nenhum recibo enviado ainda.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recibos.map(recibo => {
                    const obraRelacionada = obras.find(o => o.id === recibo.obraId);
                    return (
                      <div key={recibo.id} className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium truncate">
                              {obraRelacionada ? obraRelacionada.nome : 'Obra não encontrada'}
                            </h4>
                            <button
                              onClick={() => deletarRecibo(recibo.id)}
                              className="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-gray-600 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <p className="text-sm text-gray-400 mb-3 truncate">{recibo.nome}</p>
                          <a
                            href={recibo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 text-sm flex items-center"
                          >
                            <Image className="mr-1" size={14} />
                            Visualizar recibo
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
