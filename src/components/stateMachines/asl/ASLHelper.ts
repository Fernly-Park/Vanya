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
import { IStateMachineDefinition, StateMachineStates } from '@App/components/stateMachines/stateMachine.interfaces';
import { JSONPath } from 'jsonpath-plus';
import { STATE_MACHINE_DEFINITION_MAX_LENGTH } from '@App/utils/constants';
import { InvalidDefinitionError } from '@App/errors/AWSErrors';


export const retrieveAllStates = (def: IStateMachineDefinition): StateMachineStates => {
  const states: StateMachineStates[] = JSONPath({json: def, path: '$..[States]', flatten: true});
  const toReturn: StateMachineStates = {} ;
  states.forEach(state => {
    Object.assign(toReturn, state)
  });

  return toReturn;
};

export const ensureStateMachineDefinitionIsValid = (definition: string): void => {
  if (typeof definition !== 'string' || definition.length < 1 || definition.length > STATE_MACHINE_DEFINITION_MAX_LENGTH) {
    throw new InvalidDefinitionError('the state machine definition is invalid');
  }
  let sm: IStateMachineDefinition; 
  try {
    sm = JSON.parse(definition)
  }catch (err) {
    throw new InvalidDefinitionError(`State machine is not a valid JSON`);
  }

  const ajv = new Ajv({
    schemas: [choice, fail, parallel, pass, stateMachineSchema, state, succeed, task, wait, map]
  });
  
  const result = ajv.validate(stateMachineSchema, sm) as boolean;
  if (!result) {
    throw new InvalidDefinitionError(`Invalid State Machine Definition : ${ajv.errors[0].message}`);
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
    throw new InvalidDefinitionError(`MISSING_TRANSITION_TARGET: not all states are reachable`);
  }
}

const ensureJsonPathAreCorrects = (sm: IStateMachineDefinition) => {

  const result: [] = JSONPath({json: sm, path: '$..[InputPath,OutputPath,ResultPath]'});
  result.forEach((el: string) => {
    try {
      if (el !== null) {
        JSONPath({path: el, json: {},}) 
        if (el !== el.trim()){
          throw new Error();
        }
      }
    } catch (err) {
      throw new InvalidDefinitionError(`SCHEMA_VALIDATION_FAILED: Value is not a Reference Path`);
    }
  });
};