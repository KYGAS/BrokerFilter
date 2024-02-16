module.exports = function FilterBroker(mod) {
    const {command} = mod;

    const passiveLists = {};        
    const passiveTypes = [1, 2, 6, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008]; // Phys Amp, Mag Amp, Phys Crit Power, Mag Crit Power, Phys Piercing, Mag Piercing
    const groups = {
        'hp': [1],
        'mp': [2],
        'cf': [6],
        'phys': [1001, 1005, 1007],
        'mag': [1002, 1006, 1008],
        'pamp': [1001],
        'mamp': [1002],
        'pcp': [1005],
        'mcp': [1006],
        'pres': [1003],
        'mres': [1004],
        'ppier': [1007],
        'mpier': [1008]
    };      

    let enabled = false;
    let filterTypes = [];
    let filterCount = 0;
    let lastBrokerList = null;
    let listingCount = 0;
    let processedCount = 0;
    let validListings = [];

    for (const passiveType of passiveTypes) {
        mod.queryData('/Passivity/Passive@type=?', [passiveType], true, false, ['id']).then(results => {
            passiveLists[passiveType] = [];
            results.forEach(entry => passiveLists[passiveType].push(entry.attributes.id));
        });
    }

    command.add('filter', (...args) => {
        const count = parseInt(args[args.length - 1]) || 1;
        const types = args.slice(0, args.length - 1).map(x => x.toLowerCase());

        if (args[0] && args[0].toLowerCase() == "off") {
            enabled = false;
            filterTypes = [];
            filterCount = 0;
            listingCount = 0;
            processedCount = 0;
            validListings = [];
            command.message("Broker filter turned off.");
            return;
        }

        filterTypes = [];

        for (const type of types) {
            if (!(type in groups)) {
                command.message(`The type ${type} isn't a valid type.`);
                return;
            }
            filterTypes = filterTypes.concat(groups[type]);
        }

        enabled = true;
        filterCount = count;
        command.message(`Filtering broker offers for ${filterCount} (${types.join(", ")}) line${count > 1 ? 's' : ''}.`);
    });

    command.add('filterinfo', {
        $none() {
            command.message("Check Proxy Log.");
            mod.log("This is a quick explanation of how this module works.");
            mod.log("Command 'filterinfo help' will show how to type the commands.");
            mod.log("Command 'filterinfo types' will show the available types of rolls.");
        },
        help() {
            command.message("Check Proxy Log.");
            mod.log("The filter commands should always be 'filter type number'.");
            mod.log("'filter' is the general command, no need to explain much.");
            mod.log("'type' is the type of roll you want shown (can be found how to type them in the command 'filterinfo types').");
            mod.log("'number' is the minimum amount of rolls you're looking for.");
            mod.log("Example: You want a minimum of 2 Physical Amplification rolls, the command should be 'filter pamp 2'.");
            mod.log("'filter off' will turn off/reset the filter.");
        },
        types() {
            command.message("Check Proxy Log.");
            mod.log("This is a quick list of all the available roll types (how to use them in the command 'filterinfo help').");
            mod.log("'hp' shows Max Health rolls.");
            mod.log("'mp' shows Max Mana rolls.");
            mod.log("'cf' shows Critical Factor rolls.");
            mod.log("'phys' shows Physical Amplification, Physical Crit Power and Physical Piercing rolls.");
            mod.log("'mag' shows Magical Amplification, Magical Crit Power and Magical Piercing rolls.");
            mod.log("'pamp' shows Physical Amplification rolls.");
            mod.log("'pcp' shows Physical Crit Power rolls.");
            mod.log("'ppier' shows Physical Piercing rolls.");
            mod.log("'pres' shows Physical Resistance rolls.");
            mod.log("'mamp' shows Magical Amplification rolls.");
            mod.log("'mcp' shows Magical Crit Power rolls.");
            mod.log("'mpier' shows Magical Piercing rolls.");
            mod.log("'mres' shows Magical Resistance rolls.");
        }
    });

    mod.hook('S_TRADE_BROKER_WAITING_ITEM_LIST', '*', event => {
        if (!enabled) return;
        
        listingCount = event.listings.length;
        processedCount = 0;
        validListings = [];

        for (let i = 0; i < listingCount; i++) {
            mod.setTimeout(() => mod.toServer('C_SHOW_ITEM_TOOLTIP_EX', '*', {
                type: 13,
                id: event.listings[i].unk2,
                unk1: event.listings[i].listing,
                unk2: 0,
                unk3: 0,
                serverId: 0,
                playerId: -1,
                owner: mod.game.me.name
            }), 20 * i);
        }

        lastBrokerList = event;
        return false;
    });

    mod.hook('S_SHOW_ITEM_TOOLTIP', '*', event => {
        if (!enabled || !listingCount || event.type != 13) return;

        if (event.passivitySets.length > 0) {
            let count = 0;
            for (const passivity of event.passivitySets[0].passivities) {
                if (!passivity) continue;

                for (const passivityType of filterTypes) {
                    if (passiveLists[passivityType] && passiveLists[passivityType].includes(passivity)) {
                        count++;
                        break;
                    }
                }
            }

            if (count >= filterCount) {
                validListings.push(parseInt(event.dbid));
            }
        }

        processedCount++;
        if (processedCount >= listingCount) {
            lastBrokerList.listings = lastBrokerList.listings.filter(listing => validListings.includes(listing.unk2));
            mod.toClient('S_TRADE_BROKER_WAITING_ITEM_LIST', '*', lastBrokerList);
            listingCount = 0;
            processedCount = 0;
            validListings = [];
        }
    });
}