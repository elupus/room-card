import { HomeAssistant, LovelaceCardConfig, createThing } from 'custom-card-helpers';
import { html, PropertyValues } from 'lit';
import { HassEntity } from 'home-assistant-js-websocket';
import { UNAVAILABLE_STATES } from './lib/constants';
import { HomeAssistantEntity, RoomCardConfig, RoomCardEntity, EntityCondition, HideIfConfig } from './types/room-card-types';

export const isObject = (obj: unknown) : boolean => typeof obj === 'object' && !Array.isArray(obj) && !!obj;

export const isUnavailable = (stateObj: HomeAssistantEntity) : boolean => !stateObj || UNAVAILABLE_STATES.includes(stateObj.state);

export const hideUnavailable = (entity: RoomCardEntity) : boolean =>
    entity.hide_unavailable && isUnavailable(entity.stateObj);

export const getValue = (entity: RoomCardEntity) => {
    return entity.attribute ? entity.stateObj.attributes[entity.attribute] : entity.stateObj.state;
}

export const hideIf = (entity: RoomCardEntity, hass: HomeAssistant) => {
    if (hideUnavailable(entity)) {
        return true;
    }
    if (entity.hide_if === undefined) {
        return false;
    }

    if (<HideIfConfig>entity.hide_if)
    {
        let entityValue = entity.stateObj.state;
        const matchedConditions = (entity.hide_if as HideIfConfig).conditions?.filter(item => {
    
            if(item.entity) {                
                const stateEntity = hass.states[item.entity];
                entityValue = item.attribute ? stateEntity.attributes[item.attribute] : stateEntity.state;
            }

            if(item.attribute && !item.entity) {                
                entityValue = entity.stateObj.attributes[item.attribute];
            }
    
            return checkConditionalValue(item, entityValue);
        });
        
        return matchedConditions?.length > 0;        
    }
};

export const getEntityIds = (config: RoomCardConfig) : string[] => 
    [config.entity]
        .concat(config.entities?.map((entity) => entity.entity))
        .concat(config.info_entities?.map((entity) => entity.entity))
        .concat(config.rows?.flatMap(row => row.entities).map((entity) => entity?.entity))
        .filter((entity) => entity);

export const hasConfigOrEntitiesChanged = (node: RoomCardConfig, changedProps: PropertyValues) => {
    if (changedProps.has('config')) {
        return true;
    }

    const oldHass = changedProps.get('_hass') as HomeAssistant;
    if (oldHass) {
        return node.entityIds.some((entity: string) => oldHass.states[entity] !== node.hass.states[entity]);
    }
    return false;
};

export const checkConditionalValue = (item: EntityCondition, checkValue: unknown) => {    
    if(item.condition == 'equals' && checkValue == item.value) {
        return true;
    }
    if(item.condition == 'not_equals' && checkValue != item.value) {
        return true;
    }
    if(item.condition == 'above' && checkValue > item.value) {
        return true;
    }
    if(item.condition == 'below' && checkValue < item.value) {
        return true;
    }
}

export const mapStateObject = (entity: RoomCardEntity | string, hass: HomeAssistant) : RoomCardEntity => {        
    const conf = typeof entity === 'string' ? { entity: entity } : entity;
    return { ...conf, stateObj: hass.states[conf.entity] };
}

export const createCardElement = (cardConfig: LovelaceCardConfig, hass: HomeAssistant) => {    
    if (cardConfig.show_states && !cardConfig.show_states.includes(hass.states[cardConfig.entity].state)) {
        return;
    }

    let tag = cardConfig.type;
    if (tag.startsWith('divider')) {
        tag = `hui-divider-row`;
    } else if (tag.startsWith('custom:')) {
        tag = tag.substr('custom:'.length);
    } else {
        tag = `hui-${tag}-card`;
    }

    const element = createThing(cardConfig);
    element.hass = hass;
    element.style.boxShadow = 'none';
    element.style.borderRadius = '0';
    return element;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export const evalTemplate = (hass: HomeAssistant | undefined, state: HassEntity, func: string): Function => {
    /* eslint no-new-func: 0 */
    try {
        return new Function('states', 'entity', 'user', 'hass', 'html', `'use strict'; ${func}`).call(
            this,
            hass?.states,
            state,
            hass?.user,
            hass,
            html,
        );
    } catch (e) {
      const funcTrimmed = func.length <= 100 ? func.trim() : `${func.trim().substring(0, 98)}...`;
      e.message = `${e.name}: ${e.message} in '${funcTrimmed}'`;
      e.name = 'RoomCardJSTemplateError';
      throw e;
    }
  }