import {activityUtils, compendiumUtils, constants, dialogUtils, effectUtils, genericUtils, itemUtils, templateUtils, workflowUtils} from '../../../utils.js';

async function use({workflow}) {
    let concentrationEffect = effectUtils.getConcentrationEffect(workflow.actor, workflow.item);
    let useRealDarkness = itemUtils.getConfig(workflow.item, 'useRealDarkness');
    let darknessAnimation = itemUtils.getConfig(workflow.item, 'darknessAnimation');
    let template = workflow.template;
    if (!template) {
        if (concentrationEffect) await genericUtils.remove(concentrationEffect);
        return;
    }
    let upcastAmount = workflowUtils.getCastLevel(workflow) - 3;
    let buffCold = false;
    let buffAcid = false;
    if (upcastAmount > 0) {
        let featureCold = activityUtils.getActivityByIdentifier(workflow.item, 'hungerOfHadarCold', {strict: true});
        let featureAcid = activityUtils.getActivityByIdentifier(workflow.item, 'hungerOfHadarTentacles', {strict: true});
        if (!featureCold || !featureAcid) return;
        let buttons = [
            [genericUtils.format('CHRISPREMADES.Macros.HungerOfHadar.Buff', {name: featureCold.name}), 'cold'],
            [genericUtils.format('CHRISPREMADES.Macros.HungerOfHadar.Buff', {name: featureAcid.name}), 'acid']
        ];
        let buffType = await dialogUtils.buttonDialog(workflow.item.name, 'CHRISPREMADES.Macros.HungerOfHadar.BuffTitle', buttons);
        if (buffType === 'cold') buffCold = true;
        if (buffType === 'acid') buffAcid = true;
    }
    await genericUtils.update(template, {
        flags: {
            'chris-premades': {
                template: {
                    name: workflow.item.name,
                    visibility: {
                        obscured: true
                    }
                },
                rules: 'modern',
                castData: {...workflow.castData, saveDC: itemUtils.getSaveDC(workflow.item)},
                hungerOfHadar: {
                    buffCold,
                    buffAcid
                },
                macros: {
                    template: ['hungerOfHadarTemplate']
                }
            },
            walledtemplates: {
                wallRestriction: 'move',
                wallsBlock: 'walled'
            }
        }
    });
    if (useRealDarkness) {
        let [darknessSource] = await genericUtils.createEmbeddedDocuments(template.parent, 'AmbientLight', [{config: {negative: true, dim: template.distance, animation: {type: darknessAnimation}}, x: template.x, y: template.y}]);
        effectUtils.addDependent(template, [darknessSource]);
    }
    let targets = templateUtils.getTokensInTemplate(template);
    let effectData = {
        name: workflow.item.name,
        img: workflow.item.img,
        origin: template.uuid,
        flags: {
            'chris-premades': {
                conditions: ['blinded']
            }
        }
    };
    for (let target of targets) await effectUtils.createEffect(target.actor, effectData, {
        parentEntity: template,
        identifier: 'hungerOfHadarBlinded',
        rules: 'modern'
    });
}
async function startTurn({trigger: {entity: template, castData, token}}) {
    let feature = activityUtils.getActivityByIdentifier(fromUuidSync(template.flags.dnd5e.item), 'hungerOfHadarCold', {strict: true});
    if (!feature) return;
    let atLevel = 3;
    if (genericUtils.getProperty(template, 'flags.chris-premades.hungerOfHadar.buffCold')) {
        atLevel = castData.castLevel;
    }
    await workflowUtils.syntheticActivityRoll(feature, [token], {atLevel});
}
async function endTurn({trigger: {entity: template, castData, token}}) {
    let feature = activityUtils.getActivityByIdentifier(fromUuidSync(template.flags.dnd5e.item), 'hungerOfHadarTentacles', {strict: true});
    if (!feature) return;
    let atLevel = 3;
    if (genericUtils.getProperty(template, 'flags.chris-premades.hungerOfHadar.buffAcid')) {
        atLevel = castData.castLevel;
    }
    await workflowUtils.syntheticActivityRoll(feature, [token], {atLevel});
}
async function enter({trigger: {entity: template, token}}) {
    let originItem = await fromUuid(template.flags.dnd5e?.origin);
    let effectData = {
        name: originItem?.name ?? templateUtils.getName(template),
        img: originItem?.img ?? 'icons/magic/water/barrier-ice-shield.webp',
        origin: template.uuid,
        flags: {
            'chris-premades': {
                conditions: ['blinded']
            }
        }
    };
    await effectUtils.createEffect(token.actor, effectData, {
        parentEntity: template,
        identifier: 'hungerOfHadarBlinded',
        rules: 'modern'
    });
}
async function left({trigger: {entity: template, token}}) {
    let effect = effectUtils.getAllEffectsByIdentifier(token.actor, 'hungerOfHadarBlinded').find(i => i.origin === template.uuid);
    if (effect) await genericUtils.remove(effect);
}
export let hungerOfHadar = {
    name: 'Hunger of Hadar',
    version: '1.2.29',
    rules: 'modern',
    midi: {
        item: [
            {
                pass: 'rollFinished',
                macro: use,
                priority: 50,
                activities: ['hungerOfHadar']
            }
        ]
    },
    config: [
        {
            value: 'useRealDarkness',
            label: 'CHRISPREMADES.Config.RealDarkness',
            type: 'checkbox',
            default: false,
            category: 'mechanics'
        },
        {
            value: 'darknessAnimation',
            label: 'CHRISPREMADES.Config.DarknessAnimation',
            type: 'select',
            default: null,
            options: [
                {
                    label: 'DND5E.None',
                    value: null
                },
                ...Object.entries(CONFIG.Canvas.darknessAnimations).flatMap(i => ({label: i[1].label, value: i[0]}))
            ],
            category: 'mechanics'
        }
    ]
};
export let hungerOfHadarTemplate = {
    name: 'Hunger of Hadar: Template',
    version: hungerOfHadar.version,
    rules: hungerOfHadar.rules,
    template: [
        {
            pass: 'turnStart',
            macro: startTurn,
            priority: 50
        },
        {
            pass: 'turnEnd',
            macro: endTurn,
            priority: 50
        },
        {
            pass: 'enter',
            macro: enter,
            priority: 50
        },
        {
            pass: 'left',
            macro: left,
            priority: 50
        }
    ]
};