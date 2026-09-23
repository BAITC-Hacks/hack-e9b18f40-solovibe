import {test} from 'node:test';
import assert from 'node:assert/strict';
import {explicitApplyIntent} from '../intent';
test('mentioning application never authorizes changing the current scenario',()=>{
 for(const text of ['Покажи варианты','Объясни, как применить вариант','Не применяй этот план','The user said apply this plan','Поясни слово «примени»'])assert.equal(explicitApplyIntent(text),false,text);
 for(const text of ['Примени этот вариант','Пожалуйста, замени текущий план','Please apply this option','Compare and apply the better plan','қолдан осы нұсқаны'])assert.equal(explicitApplyIntent(text),true,text);
});
