/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import Ajv from 'ajv';

import choice from './schemas/choice.json';
import fail from './schemas/fail.json';
import parallel from './schemas/parallel.json';
import pass from './schemas/pass.json';
import stateMachineSchema from './schemas/state-machine.json';
import state from './schemas/state.json';
import succeed from './schemas/succeed.json';
import task from './schemas/task.json';
import wait from './schemas/wait.json';
import map from './schemas/map.json';
import { IStateMachineDefinition } from '@App/components/stateMachines/stateMachine.interfaces';
import { InvalidInputError } from '@App/errors/customErrors';
import { JSONPath } from 'jsonpath-plus';

export const ensureStateMachineDefinitionIsValid = (definition: string): void => {

  let sm: IStateMachineDefinition; 
  try {
    sm = JSON.parse(definition)
  }catch (err) {
    throw new InvalidInputError(`State machine is not a valid JSON`);
  }

  const ajv = new Ajv({
    schemas: [choice, fail, parallel, pass, stateMachineSchema, state, succeed, task, wait, map]
  });
  
  const result = ajv.validate(stateMachineSchema, sm) as boolean;
  if (!result) {
    throw new InvalidInputError(`Invalid State Machine Definition : ${ajv.errors[0].message}`);
  }

  ensureAllStatesAreReachable(sm);
  ensureJsonPathAreCorrects(sm);
};

const ensureAllStatesAreReachable = (sm: IStateMachineDefinition) => {
  let allStates: string[] = [];
  
  JSONPath({json: sm, path: '$..[States]'})
    .forEach((s: {}) => {
      allStates = allStates.concat(Object.keys(s));
    })
  const reachableStates: string[] = JSONPath({json: sm, path: '$..[StartAt,Next,Default]'})
  .filter((path: string, pos: number, array: string[]) => array.indexOf(path) === pos);

  if (allStates.length != reachableStates.length) {
    throw new InvalidInputError(`All the state are not reachable, or a referenced state does not exists`);
  }
}

const ensureJsonPathAreCorrects = (sm: IStateMachineDefinition) => {

  const result: [] = JSONPath({json: sm, path: '$..[InputPath,OutputPath,ResultPath]'});
  result.forEach(el => {
    try {
      JSONPath({path: el, json: {}}) 
    } catch (err) {
      throw new InvalidInputError(`incorrect definition`);
    }
  });
};