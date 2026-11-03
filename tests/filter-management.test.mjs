import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const between=(start,end)=>{
  const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Trecho encontrado: '+start);
  return src.slice(a,b);
};
const grid=between('function filters(){','function testFilters(){');
const editor=between('function editFilterModal(filterId){','function updateCategoryOptions(){');
const saving=between('async function saveFilterChanges(form){','function updateCategoryOptions(){');

test('Galeria tem visualização clicável com controles de empresa e categoria',()=>{
  assert.match(grid,/data-act="view-filter"/);
  assert.match(grid,/filter-card-open/);
  assert.match(grid,/filter-card-manage/);
  assert.match(grid,/filterLibraryCompany/);
  assert.match(grid,/filterLibraryCategory/);
  assert.match(src,/filterLibraryCompanyId=event\.target\.value/);
  assert.match(src,/filterLibraryCategoryId=event\.target\.value/);
});

test('Modal apresenta PNG inteiro, nome, categoria, substituição e exclusão',()=>{
  assert.match(editor,/filter-editor-large-preview/);
  assert.match(editor,/data-img="\$\{escapeHtml\(filter\.id\)\}"/);
  assert.match(editor,/field\('name','Nome do filtro',filter\.name\)/);
  assert.match(editor,/id="editFilterCategory" name="category_id"/);
  assert.match(editor,/id="editFilterFile" name="file" type="file" accept="image\/png/);
  assert.match(editor,/data-act="remove-filter"/);
  assert.match(editor,/id="filterEditorPreviewCaption"/);
  assert.match(editor,/data-act="toggle-filter-preview-bg"/);
  assert.match(src,/id='editFilterForm'|form\.id==='editFilterForm'/);
  assert.match(styles,/\.modal\.modal-filter-preview/);
  assert.match(styles,/\.filter-editor-large-preview img\{[\s\S]*object-fit:contain/);
  assert.match(styles,/\.filter-editor-large-preview\.is-dark/);
});

test('Categorias do editor nunca vêm de outra empresa',()=>{
  assert.match(editor,/app\.categories\.filter\(c=>c\.company_id===filter\.company_id\)/);
  assert.match(saving,/c\.id===categoryId&&c\.company_id===filter\.company_id/);
  assert.match(saving,/Escolha uma categoria pertencente à mesma empresa/);
});

function makeScenario({file=null,dbError=null,category='cat2',name='Novo nome'}={}){
  const original={id:'filter-one',company_id:'company-one',category_id:'cat1',
    name:'Filtro antigo',storage_path:'company-one/old.png'};
  const app={profile:{role:'admin'},modal:{recordId:'filter-one'},
    filters:[original],categories:[
      {id:'cat1',company_id:'company-one'},
      {id:'cat2',company_id:'company-one'},
      {id:'other',company_id:'another-company'}
    ],images:new Map([['filter-one','blob:old']])};
  const operations=[];
  let updatedPayload;
  let validated=false;
  let cleared=false;
  const storage={
    upload:async(path,uploadFile,opts)=>{
      operations.push({type:'upload',path,opts});
      assert.equal(uploadFile,file);
      return {error:null};
    },
    remove:async(paths)=>{
      operations.push({type:'remove',paths});
      return {error:null};
    }
  };
  const query={
    eq(){return this;},
    select(){return this;},
    async single(){
      operations.push({type:'update'});
      return dbError?{error:new Error(dbError),data:null}:{error:null,data:{id:original.id}};
    }
  };
  const api={
    storage:{from(name){assert.equal(name,'company-filters');return storage;}},
    from(name){
      assert.equal(name,'filters');
      return {update(payload){updatedPayload=payload;return query;}};
    }
  };
  const mockURL={revokeObjectURL(url){operations.push({type:'revoke',url});}};
  const save=new Function('app','api','validatePNG','id','URL','clearFilterDraftUrl',
    saving+';return saveFilterChanges;')(
      app,api,async(f)=>{assert.equal(f,file);validated=true;},
      ()=>'new-uuid',mockURL,()=>{cleared=true;}
    );
  const form={elements:{
    name:{value:name},category_id:{value:category},file:{files:file?[file]:[]}
  }};
  return {save,form,app,operations,get payload(){return updatedPayload;},
    get validated(){return validated;},get cleared(){return cleared;}};
}

test('Troca somente categoria/nome sem reenviar o PNG atual',async()=>{
  const sc=makeScenario();
  await sc.save(sc.form);
  assert.deepEqual(sc.payload,{name:'Novo nome',category_id:'cat2'});
  assert.ok(!sc.operations.some(op=>op.type==='upload'||op.type==='remove'));
  assert.equal(sc.cleared,true);
});

test('Substituição envia arquivo novo e atualiza o registro antes de apagar o antigo',async()=>{
  const file={type:'image/png',size:32768};
  const sc=makeScenario({file});
  await sc.save(sc.form);
  assert.equal(sc.validated,true);
  assert.equal(sc.payload.storage_path,'company-one/new-uuid.png');
  const sequence=sc.operations.map(op=>op.type);
  assert.ok(sequence.indexOf('upload')<sequence.indexOf('update'));
  assert.ok(sequence.indexOf('update')<sequence.indexOf('remove'));
  assert.deepEqual(sc.operations.find(op=>op.type==='remove').paths,['company-one/old.png']);
  assert.equal(sc.app.images.has('filter-one'),false);
});

test('Falha ao atualizar banco remove apenas o upload novo, preservando original',async()=>{
  const file={type:'image/png',size:1234};
  const sc=makeScenario({file,dbError:'Falha simulada'});
  await assert.rejects(sc.save(sc.form),/Falha simulada/);
  assert.equal(sc.operations.filter(op=>op.type==='upload').length,1);
  assert.equal(sc.operations.filter(op=>op.type==='remove').length,1);
  assert.deepEqual(sc.operations.find(op=>op.type==='remove').paths,['company-one/new-uuid.png']);
  assert.ok(sc.app.images.has('filter-one'));
});

test('Mover filtro para categoria de outra empresa é rejeitado antes da escrita',async()=>{
  const sc=makeScenario({category:'other',file:{type:'image/png',size:200}});
  await assert.rejects(sc.save(sc.form),/mesma empresa/);
  assert.equal(sc.operations.length,0);
});

test('Excluir filtro requer confirmação explícita',()=>{
  assert.match(src,/if\(act==='remove-filter'\)\{\s*if\(!confirm\('Excluir este filtro permanentemente/);
  assert.match(src,/api\.from\('filters'\)\.delete\(\)\.eq\('id',uid\)/);
});
