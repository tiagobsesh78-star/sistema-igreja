"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../src/lib/supabase";

export default function NovoUsuarioPage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    nivel_acesso: "Membro" // Default
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);

    const { error } = await supabase.from("usuarios").insert([formData]);

    if (error) {
      alert("Erro ao cadastrar usuário: " + error.message);
      setSalvando(false);
    } else {
      alert("Usuário cadastrado com sucesso!");
      // Aqui depois você pode redirecionar para uma lista de usuários
      setFormData({ nome: "", email: "", senha: "", nivel_acesso: "Membro" });
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cadastrar Novo Usuário</h1>
          <Link href="/membros" className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition text-sm">
            Voltar
          </Link>
        </div>

        <form onSubmit={handleSalvar} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
              <input 
                type="text" 
                name="nome"
                required
                value={formData.nome}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail de Acesso</label>
              <input 
                type="email" 
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Senha Provisória</label>
              <input 
                type="text" 
                name="senha"
                required
                value={formData.senha}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nível de Acesso</label>
              <select 
                name="nivel_acesso"
                required
                value={formData.nivel_acesso}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition cursor-pointer"
              >
                <option value="Administrador">Administrador (Acesso Total)</option>
                <option value="Líder">Líder (Acesso Restrito a Edições Específicas)</option>
                <option value="Membro">Membro (Apenas Visualização)</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                * Defina com cuidado o nível de permissão. Isso afetará o que o usuário pode ver e alterar no sistema.
              </p>
            </div>

          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={salvando}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 transition flex items-center justify-center min-w-[150px]"
            >
              {salvando ? "Salvando..." : "Cadastrar Usuário"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}